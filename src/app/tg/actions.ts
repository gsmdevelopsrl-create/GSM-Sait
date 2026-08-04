"use server";

import { createClient as createRawClient } from "@supabase/supabase-js";
import { verifyInitData } from "@/lib/telegram/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import type { Ticket } from "@/lib/types";

export type TgProfile = {
  id: string;
  full_name: string | null;
  position: string | null;
  role: "client" | "admin";
  company_id: string | null;
  company_name: string;
};

export type TgState =
  | { status: "error"; message: string }
  | { status: "not_linked" }
  | { status: "ready"; profile: TgProfile; tickets: Ticket[] };

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type Resolved =
  | { ok: false; error: string }
  | { ok: true; admin: AdminClient; profile: TgProfile | null };

/** Общая проверка: подпись Telegram + привязанный профиль. */
async function resolve(initData: string): Promise<Resolved> {
  const tgUser = verifyInitData(initData);
  if (!tgUser)
    return { ok: false, error: "Не удалось подтвердить вход через Telegram." };

  const admin = createAdminClient();
  if (!admin)
    return {
      ok: false,
      error:
        "Сервис временно недоступен: не настроен серверный ключ. Обратитесь к администратору.",
    };

  const { data } = await admin
    .from("profiles")
    .select("id, full_name, position, role, company_id, companies(name)")
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  if (!data) return { ok: true, admin, profile: null };

  const profile: TgProfile = {
    id: data.id,
    full_name: data.full_name,
    position: data.position,
    role: data.role,
    company_id: data.company_id,
    company_name: one<{ name: string }>(data.companies as never)?.name ?? "—",
  };
  return { ok: true, admin, profile };
}

/** Загрузка состояния Mini App при открытии. */
export async function tgLoad(initData: string): Promise<TgState> {
  const r = await resolve(initData);
  if (!r.ok) return { status: "error", message: r.error };
  if (!r.profile) return { status: "not_linked" };

  const { data: raw } = await r.admin
    .from("tickets")
    .select(
      `id, title, category, priority, status, description, deadline, estimate, assignee, created_at, company_id, author_id,
       companies(name),
       author:profiles!tickets_author_id_fkey(full_name),
       ticket_comments(id, ticket_id, author_name, is_client, body, created_at)`
    )
    .eq("company_id", r.profile.company_id ?? "")
    .order("created_at", { ascending: false });

  const tickets: Ticket[] = ((raw ?? []) as unknown as Record<string, unknown>[]).map(
    (t) => ({
      ...(t as unknown as Ticket),
      company: one<{ name: string }>(t.companies as never),
      author: one<{ full_name: string | null }>(t.author as never),
    })
  );

  return { status: "ready", profile: r.profile, tickets };
}

/** Привязка Telegram к существующему аккаунту клиента (один раз). */
export async function tgLink(
  initData: string,
  email: string,
  password: string
): Promise<{ error?: string }> {
  const tgUser = verifyInitData(initData);
  if (!tgUser) return { error: "Не удалось подтвердить вход через Telegram." };

  const admin = createAdminClient();
  if (!admin) return { error: "Сервис временно недоступен." };

  if (!email.trim() || !password) return { error: "Введите email и пароль." };

  // Проверяем пароль обычным способом, без сохранения сессии
  const raw = createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await raw.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.user) return { error: "Неверный email или пароль." };

  // Один Telegram — один аккаунт: снимаем старую привязку
  await admin
    .from("profiles")
    .update({ telegram_id: null })
    .eq("telegram_id", tgUser.id);

  const { error: linkErr } = await admin
    .from("profiles")
    .update({ telegram_id: tgUser.id })
    .eq("id", data.user.id);

  if (linkErr) return { error: "Не удалось привязать аккаунт." };
  return {};
}

/** Создание заявки из Mini App. */
export async function tgCreateTicket(
  initData: string,
  input: {
    title: string;
    category: string;
    priority: string;
    description: string;
  }
): Promise<{ error?: string }> {
  const r = await resolve(initData);
  if (!r.ok) return { error: r.error };
  if (!r.profile) return { error: "Аккаунт не привязан." };
  if (!r.profile.company_id)
    return { error: "У профиля не указана компания. Обратитесь к администратору." };
  if (!input.title.trim()) return { error: "Укажите заголовок заявки." };

  const { data: ticket, error } = await r.admin
    .from("tickets")
    .insert({
      title: input.title.trim(),
      category: input.category,
      priority: input.priority,
      status: "Новая",
      description: input.description.trim() || null,
      company_id: r.profile.company_id,
      author_id: r.profile.id,
    })
    .select("id")
    .single();

  if (error || !ticket) return { error: "Не удалось создать заявку." };

  await notify({
    type: "ticket.created",
    ticketId: ticket.id,
    title: input.title,
    company: r.profile.company_name,
    author: `${r.profile.full_name ?? "Клиент"} (Telegram)`,
    priority: input.priority,
    category: input.category,
  });

  return {};
}

/** Комментарий к заявке из Mini App. */
export async function tgAddComment(
  initData: string,
  ticketId: number,
  body: string
): Promise<{ error?: string }> {
  const r = await resolve(initData);
  if (!r.ok) return { error: r.error };
  if (!r.profile) return { error: "Аккаунт не привязан." };

  const text = body.trim();
  if (!text) return {};

  // Заявка должна принадлежать компании клиента
  const { data: t } = await r.admin
    .from("tickets")
    .select("id, company_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t || t.company_id !== r.profile.company_id)
    return { error: "Заявка не найдена." };

  const { error } = await r.admin.from("ticket_comments").insert({
    ticket_id: ticketId,
    author_id: r.profile.id,
    author_name: r.profile.full_name ?? "Клиент",
    is_client: r.profile.role === "client",
    body: text,
  });

  if (error) return { error: "Не удалось отправить комментарий." };
  return {};
}
