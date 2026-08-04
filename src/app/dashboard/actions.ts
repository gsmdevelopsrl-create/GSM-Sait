"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import type { AttachmentType, TicketStatus } from "@/lib/types";

type Me = {
  id: string;
  full_name: string | null;
  role: "client" | "admin";
  company_id: string | null;
  company_name: string;
};

async function getMe(): Promise<Me | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id, companies(name)")
    .eq("id", user.id)
    .single();

  if (!data) return null;
  const company = (data as { companies?: unknown }).companies as
    | { name: string }
    | { name: string }[]
    | null;
  const companyName = Array.isArray(company)
    ? company[0]?.name ?? "—"
    : company?.name ?? "—";

  return {
    id: data.id,
    full_name: data.full_name,
    role: data.role,
    company_id: data.company_id,
    company_name: companyName,
  };
}

export type CreateTicketInput = {
  title: string;
  category: string;
  priority: string;
  deadline: string; // yyyy-mm-dd | ""
  estimate: string; // число | ""
  description: string;
  attachments: { type: AttachmentType; name: string; url?: string }[];
};

export async function createTicket(
  input: CreateTicketInput
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла, войдите заново." };
  if (!me.company_id)
    return { error: "У профиля не указана компания. Обратитесь к администратору." };

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      title: input.title.trim() || "Без названия",
      category: input.category,
      priority: input.priority,
      status: "Новая",
      description: input.description.trim() || null,
      deadline: input.deadline || null,
      estimate: input.estimate ? Number(input.estimate) : null,
      company_id: me.company_id,
      author_id: me.id,
    })
    .select("id")
    .single();

  if (error || !ticket) return { error: "Не удалось создать заявку." };

  if (input.attachments.length) {
    await supabase.from("ticket_attachments").insert(
      input.attachments.map((a) => ({
        ticket_id: ticket.id,
        type: a.type,
        name: a.name,
        url: a.url ?? null,
      }))
    );
  }

  await notify({
    type: "ticket.created",
    ticketId: ticket.id,
    title: input.title,
    company: me.company_name,
    author: me.full_name ?? "Клиент",
    priority: input.priority,
    category: input.category,
  });

  revalidatePath("/dashboard");
  return {};
}

export async function changeStatus(
  ticketId: number,
  status: TicketStatus
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me || me.role !== "admin") return { error: "Нет прав." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .update({ status })
    .eq("id", ticketId)
    .select("title, companies(name)")
    .single();

  if (error) return { error: "Не удалось изменить статус." };

  const company = (data as { companies?: unknown } | null)?.companies as
    | { name: string }
    | { name: string }[]
    | null;
  const companyName = Array.isArray(company) ? company[0]?.name : company?.name;

  await notify({
    type: "ticket.status_changed",
    ticketId,
    title: data?.title ?? "",
    company: companyName ?? "—",
    status,
  });

  revalidatePath("/dashboard");
  return {};
}

export async function changeAssignee(
  ticketId: number,
  assignee: string
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me || me.role !== "admin") return { error: "Нет прав." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({ assignee })
    .eq("id", ticketId);

  if (error) return { error: "Не удалось назначить исполнителя." };
  revalidatePath("/dashboard");
  return {};
}

export async function addComment(
  ticketId: number,
  body: string
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла." };
  const text = body.trim();
  if (!text) return {};

  const supabase = await createClient();
  const { error } = await supabase.from("ticket_comments").insert({
    ticket_id: ticketId,
    author_id: me.id,
    author_name: me.full_name ?? (me.role === "admin" ? "Администратор" : "Клиент"),
    is_client: me.role === "client",
    body: text,
  });

  if (error) return { error: "Не удалось отправить комментарий." };
  revalidatePath("/dashboard");
  return {};
}

export async function updateProfile(input: {
  full_name: string;
  company: string;
}): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла, войдите заново." };
  if (!input.full_name.trim()) return { error: "Укажите имя." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: input.full_name,
    p_company: input.company,
  });

  if (error) return { error: "Не удалось сохранить изменения." };
  revalidatePath("/dashboard");
  return {};
}

export async function updateCompany(input: {
  companyId: string;
  name: string;
  members: { id: string; full_name: string }[];
}): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me || me.role !== "admin") return { error: "Нет прав." };

  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) return { error: "Укажите название компании." };

  const { error: cErr } = await supabase
    .from("companies")
    .update({ name })
    .eq("id", input.companyId);
  if (cErr)
    return { error: "Не удалось переименовать компанию (имя уже занято?)." };

  for (const m of input.members) {
    const fn = m.full_name.trim();
    if (fn) {
      await supabase.from("profiles").update({ full_name: fn }).eq("id", m.id);
    }
  }

  revalidatePath("/dashboard");
  return {};
}
