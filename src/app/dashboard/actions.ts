"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import { normalizeMdPhone, MD_PHONE_HINT } from "@/lib/phone";
import { BUCKET } from "@/lib/attachments";
import { extractTextFromImage } from "@/lib/openai/vision";
import type { AttachmentType, TicketStatus } from "@/lib/types";


function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

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
): Promise<{ error?: string; ticketId?: number }> {
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
      source: "site",
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
  return { ticketId: ticket.id };
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

/** Отметить переписку заявки прочитанной текущим пользователем. */
export async function markTicketRead(
  ticketId: number
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return {};

  const supabase = await createClient();
  await supabase
    .from("ticket_reads")
    .upsert(
      { ticket_id: ticketId, user_id: me.id, last_read_at: new Date().toISOString() },
      { onConflict: "ticket_id,user_id" }
    );

  return {};
}

export async function updateProfile(input: {
  full_name: string;
  company: string;
  position: string;
  phone: string;
}): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла, войдите заново." };
  if (!input.full_name.trim()) return { error: "Укажите имя." };

  const phone = normalizeMdPhone(input.phone);
  if (!phone) return { error: `Неверный номер телефона. ${MD_PHONE_HINT}` };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: input.full_name,
    p_company: input.company,
    p_position: input.position,
    p_phone: phone,
  });

  if (error) return { error: "Не удалось сохранить изменения." };
  revalidatePath("/dashboard");
  return {};
}

/**
 * Правка заявки.
 * Админ — всегда и все поля. Клиент — свою заявку, пока статус «Новая».
 */
export async function updateTicket(
  ticketId: number,
  input: {
    title: string;
    category: string;
    priority: string;
    description: string;
    deadline: string;
    estimate: string;
  }
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла, войдите заново." };
  if (!input.title.trim()) return { error: "Укажите заголовок." };

  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tickets")
    .select("id, status, company_id, author_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return { error: "Заявка не найдена." };

  // Клиент правит только свои заявки и только пока они «Новые»
  if (me.role !== "admin") {
    if (t.company_id !== me.company_id) return { error: "Нет доступа к заявке." };
    if (t.author_id !== me.id)
      return { error: "Редактировать заявку может только её автор." };
    if (t.status !== "Новая")
      return {
        error: "Заявку уже взяли в работу — изменить её нельзя. Напишите в переписке.",
      };
  }

  const { error } = await supabase
    .from("tickets")
    .update({
      title: input.title.trim(),
      category: input.category,
      priority: input.priority,
      description: input.description.trim() || null,
      deadline: input.deadline || null,
      estimate: input.estimate ? Number(input.estimate) : null,
    })
    .eq("id", ticketId);

  if (error) return { error: "Не удалось сохранить изменения." };
  revalidatePath("/dashboard");
  return {};
}

/**
 * Администратор указывает оценку работ в часах.
 * Заявка сразу уходит клиенту на утверждение (в т.ч. после отказа — с новой оценкой).
 */
export async function setEstimate(
  ticketId: number,
  hours: string
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me || me.role !== "admin") return { error: "Нет прав." };

  const n = Number(hours);
  if (!hours.trim() || !Number.isFinite(n) || n <= 0)
    return { error: "Укажите оценку в часах числом больше нуля." };

  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tickets")
    .select("id, status, title, companies(name)")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return { error: "Заявка не найдена." };

  const toApproval = t.status === "Новая" || t.status === "Отклонена";
  const { error } = await supabase
    .from("tickets")
    .update({
      estimate: n,
      ...(toApproval
        ? { status: "На утверждении" as TicketStatus, rejection_reason: null }
        : {}),
    })
    .eq("id", ticketId);

  if (error) return { error: "Не удалось сохранить оценку." };

  if (toApproval) {
    const company = one<{ name: string }>(
      (t as { companies?: unknown }).companies as never
    );
    await notify({
      type: "ticket.status_changed",
      ticketId,
      title: t.title ?? "",
      company: company?.name ?? "—",
      status: `На утверждении (оценка ${n} ч)`,
    });
  }

  revalidatePath("/dashboard");
  return {};
}

/** Автор заявки соглашается с оценкой. */
export async function approveTicket(
  ticketId: number
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла." };

  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tickets")
    .select("id, status, author_id, title, companies(name)")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return { error: "Заявка не найдена." };
  if (t.author_id !== me.id)
    return { error: "Утвердить заявку может только её автор." };
  if (t.status !== "На утверждении")
    return { error: "Заявка не находится на утверждении." };

  const { error } = await supabase
    .from("tickets")
    .update({ status: "Утверждена", rejection_reason: null })
    .eq("id", ticketId);
  if (error) return { error: "Не удалось утвердить заявку." };

  const company = one<{ name: string }>(
    (t as { companies?: unknown }).companies as never
  );
  await notify({
    type: "ticket.status_changed",
    ticketId,
    title: t.title ?? "",
    company: company?.name ?? "—",
    status: "Утверждена клиентом",
  });

  revalidatePath("/dashboard");
  return {};
}

/** Автор заявки отклоняет оценку — причина обязательна. */
export async function rejectTicket(
  ticketId: number,
  reason: string
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла." };

  const text = reason.trim();
  if (!text) return { error: "Укажите причину отклонения." };

  const supabase = await createClient();
  const { data: t } = await supabase
    .from("tickets")
    .select("id, status, author_id, title, companies(name)")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return { error: "Заявка не найдена." };
  if (t.author_id !== me.id)
    return { error: "Отклонить заявку может только её автор." };
  if (t.status !== "На утверждении")
    return { error: "Заявка не находится на утверждении." };

  const { error } = await supabase
    .from("tickets")
    .update({ status: "Отклонена", rejection_reason: text })
    .eq("id", ticketId);
  if (error) return { error: "Не удалось отклонить заявку." };

  const company = one<{ name: string }>(
    (t as { companies?: unknown }).companies as never
  );
  await notify({
    type: "ticket.status_changed",
    ticketId,
    title: t.title ?? "",
    company: company?.name ?? "—",
    status: `Отклонена клиентом: ${text}`,
  });

  revalidatePath("/dashboard");
  return {};
}

/** Запись о загруженном файле (сам файл клиент кладёт в Storage напрямую). */
export async function registerAttachment(input: {
  ticketId: number;
  type: AttachmentType;
  name: string;
  storagePath?: string;
  url?: string;
  size?: number;
}): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла." };

  const supabase = await createClient();
  const { error } = await supabase.from("ticket_attachments").insert({
    ticket_id: input.ticketId,
    type: input.type,
    name: input.name,
    url: input.url ?? null,
    storage_path: input.storagePath ?? null,
    size_bytes: input.size ?? null,
  });

  if (error) return { error: "Не удалось прикрепить файл." };
  revalidatePath("/dashboard");
  return {};
}

/**
 * Удаление вложения: убираем файл из хранилища и запись из базы.
 * Права те же, что на правку заявки: админ — всегда, клиент — пока «Новая».
 */
export async function deleteAttachment(
  attachmentId: string
): Promise<{ error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла." };

  const supabase = await createClient();

  const { data: a } = await supabase
    .from("ticket_attachments")
    .select("id, storage_path, ticket_id, tickets(status, company_id, author_id)")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!a) return { error: "Вложение не найдено." };

  const t = one<{
    status: string;
    company_id: string | null;
    author_id: string | null;
  }>((a as { tickets?: unknown }).tickets as never);

  // Клиент удаляет вложения только в своих заявках и только пока они «Новые»
  if (me.role !== "admin") {
    if (!t || t.company_id !== me.company_id)
      return { error: "Нет доступа к заявке." };
    if (t.author_id !== me.id)
      return { error: "Удалять вложения может только автор заявки." };
    if (t.status !== "Новая")
      return { error: "Заявка уже в работе — вложения изменить нельзя." };
  }

  if (a.storage_path) {
    await supabase.storage.from(BUCKET).remove([a.storage_path]);
  }

  const { error } = await supabase
    .from("ticket_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) return { error: "Не удалось удалить вложение." };
  revalidatePath("/dashboard");
  return {};
}

/**
 * Распознать текст на картинке — доступно только администратору.
 * Результат сохраняется, повторно модель не вызывается.
 */
export async function ocrAttachment(
  attachmentId: string
): Promise<{ text?: string; error?: string }> {
  const me = await getMe();
  if (!me || me.role !== "admin") return { error: "Нет прав." };

  const supabase = await createClient();
  const { data: a } = await supabase
    .from("ticket_attachments")
    .select("id, type, storage_path, ocr_text")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!a) return { error: "Вложение не найдено." };
  if (a.ocr_text !== null && a.ocr_text !== undefined)
    return { text: a.ocr_text }; // уже распознавали
  if (a.type !== "image" || !a.storage_path)
    return { error: "Распознавание работает только для картинок." };

  const { data: signed, error: urlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(a.storage_path, 600);
  if (urlErr || !signed) return { error: "Файл недоступен." };

  const res = await extractTextFromImage(signed.signedUrl);
  if (res.error) return { error: res.error };

  await supabase
    .from("ticket_attachments")
    .update({ ocr_text: res.text ?? "" })
    .eq("id", attachmentId);

  revalidatePath("/dashboard");
  return { text: res.text ?? "" };
}

/** Временная ссылка на скачивание вложения (действует 1 час). */
export async function getAttachmentUrl(
  storagePath: string
): Promise<{ url?: string; error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Сессия истекла." };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data) return { error: "Файл недоступен." };
  return { url: data.signedUrl };
}

export async function updateCompany(input: {
  companyId: string;
  name: string;
  members: { id: string; full_name: string; position: string }[];
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
      await supabase
        .from("profiles")
        .update({ full_name: fn, position: m.position.trim() || null })
        .eq("id", m.id);
    }
  }

  revalidatePath("/dashboard");
  return {};
}
