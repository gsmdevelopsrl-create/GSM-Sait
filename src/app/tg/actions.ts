"use server";

import { createClient as createRawClient } from "@supabase/supabase-js";
import { verifyInitData } from "@/lib/telegram/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { normalizeMdPhone, MD_PHONE_HINT } from "@/lib/phone";
import { BUCKET, buildStoragePath } from "@/lib/attachments";
import type { Ticket, TicketStatus, AttachmentType } from "@/lib/types";

export type TgProfile = {
  id: string;
  full_name: string | null;
  position: string | null;
  phone: string | null;
  telegram_username: string | null;
  role: "client" | "admin";
  company_id: string | null;
  company_name: string;
};

export type TgState =
  | { status: "error"; message: string }
  | { status: "not_linked" }
  | { status: "ready"; profile: TgProfile; tickets: Ticket[]; team: string[] };

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
    .select(
      "id, full_name, position, phone, telegram_username, role, company_id, companies(name)"
    )
    .eq("telegram_id", tgUser.id)
    .maybeSingle();

  if (!data) return { ok: true, admin, profile: null };

  // Подхватываем из Telegram то, что он отдаёт сам: ник и имя.
  // Имя пишем только если его ещё нет — введённое пользователем важнее.
  const tgName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ");
  const patch: Record<string, string> = {};
  if (tgUser.username && tgUser.username !== data.telegram_username) {
    patch.telegram_username = tgUser.username;
  }
  if (!data.full_name && tgName) patch.full_name = tgName;

  if (Object.keys(patch).length) {
    await admin.from("profiles").update(patch).eq("id", data.id);
  }

  const profile: TgProfile = {
    id: data.id,
    full_name: patch.full_name ?? data.full_name,
    position: data.position,
    phone: data.phone,
    telegram_username: patch.telegram_username ?? data.telegram_username ?? null,
    role: data.role,
    company_id: data.company_id,
    company_name: one<{ name: string }>(data.companies as never)?.name ?? "—",
  };
  return { ok: true, admin, profile };
}

/** Клиент видит только свою компанию; админ — все заявки. */
async function loadTickets(
  admin: AdminClient,
  profile: TgProfile
): Promise<Ticket[]> {
  let q = admin
    .from("tickets")
    .select(
      `id, title, category, priority, status, description, deadline, estimate, assignee, source, created_at, company_id, author_id,
       companies(name),
       author:profiles!tickets_author_id_fkey(full_name, telegram_username),
       ticket_attachments(id, ticket_id, type, name, url, storage_path, size_bytes),
       ticket_comments(id, ticket_id, author_name, is_client, body, created_at)`
    )
    .order("created_at", { ascending: false });

  if (profile.role !== "admin") {
    q = q.eq("company_id", profile.company_id ?? "");
  }

  const { data: raw } = await q;

  const tickets: Ticket[] = ((raw ?? []) as unknown as Record<string, unknown>[]).map(
    (t) => ({
      ...(t as unknown as Ticket),
      company: one<{ name: string }>(t.companies as never),
      author: one<{
        full_name: string | null;
        telegram_username?: string | null;
      }>(t.author as never),
    })
  );

  // Временные ссылки на файлы (1 час)
  const paths = tickets
    .flatMap((t) => t.ticket_attachments ?? [])
    .map((a) => a.storage_path)
    .filter((p): p is string => !!p);

  if (paths.length) {
    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrls(paths, 3600);
    const map = new Map(
      (signed ?? []).map((s) => [s.path ?? "", s.signedUrl])
    );
    for (const t of tickets) {
      for (const a of t.ticket_attachments ?? []) {
        if (a.storage_path) a.signedUrl = map.get(a.storage_path) ?? null;
      }
    }
  }

  return tickets;
}

/** Загрузка состояния Mini App при открытии. */
export async function tgLoad(initData: string): Promise<TgState> {
  const r = await resolve(initData);
  if (!r.ok) return { status: "error", message: r.error };
  if (!r.profile) return { status: "not_linked" };

  const tickets = await loadTickets(r.admin, r.profile);

  let team: string[] = [];
  if (r.profile.role === "admin") {
    const { data } = await r.admin
      .from("profiles")
      .select("full_name")
      .eq("role", "admin");
    team = [
      "—",
      ...(data ?? [])
        .map((p) => p.full_name)
        .filter((n): n is string => !!n),
    ];
  }

  return { status: "ready", profile: r.profile, tickets, team };
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
): Promise<{ error?: string; ticketId?: number }> {
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
      source: "telegram",
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

  return { ticketId: ticket.id };
}

/** Правка заявки: админ — всегда, клиент — свою и пока статус «Новая». */
export async function tgUpdateTicket(
  initData: string,
  ticketId: number,
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
  if (!input.title.trim()) return { error: "Укажите заголовок." };

  const { data: t } = await r.admin
    .from("tickets")
    .select("id, status, company_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return { error: "Заявка не найдена." };

  if (r.profile.role !== "admin") {
    if (t.company_id !== r.profile.company_id)
      return { error: "Нет доступа к заявке." };
    if (t.status !== "Новая")
      return { error: "Заявку уже взяли в работу — изменить её нельзя." };
  }

  const { error } = await r.admin
    .from("tickets")
    .update({
      title: input.title.trim(),
      category: input.category,
      priority: input.priority,
      description: input.description.trim() || null,
    })
    .eq("id", ticketId);

  if (error) return { error: "Не удалось сохранить изменения." };
  return {};
}

/** Смена статуса — только админ. */
export async function tgSetStatus(
  initData: string,
  ticketId: number,
  status: TicketStatus
): Promise<{ error?: string }> {
  const r = await resolve(initData);
  if (!r.ok) return { error: r.error };
  if (r.profile?.role !== "admin") return { error: "Нет прав." };

  const { data, error } = await r.admin
    .from("tickets")
    .update({ status })
    .eq("id", ticketId)
    .select("title, companies(name)")
    .single();

  if (error) return { error: "Не удалось изменить статус." };

  const company = one<{ name: string }>(
    (data as { companies?: unknown } | null)?.companies as never
  );

  await notify({
    type: "ticket.status_changed",
    ticketId,
    title: data?.title ?? "",
    company: company?.name ?? "—",
    status,
  });

  return {};
}

/** Назначение исполнителя — только админ. */
export async function tgSetAssignee(
  initData: string,
  ticketId: number,
  assignee: string
): Promise<{ error?: string }> {
  const r = await resolve(initData);
  if (!r.ok) return { error: r.error };
  if (r.profile?.role !== "admin") return { error: "Нет прав." };

  const { error } = await r.admin
    .from("tickets")
    .update({ assignee })
    .eq("id", ticketId);

  if (error) return { error: "Не удалось назначить исполнителя." };
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

  const { data: t } = await r.admin
    .from("tickets")
    .select("id, company_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return { error: "Заявка не найдена." };
  if (r.profile.role !== "admin" && t.company_id !== r.profile.company_id)
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

/**
 * Ссылка для прямой загрузки файла в хранилище.
 * Сам файл браузер отправляет в Supabase, минуя наш сервер.
 */
export async function tgCreateUpload(
  initData: string,
  ticketId: number,
  fileName: string
): Promise<{ error?: string; path?: string; token?: string }> {
  const r = await resolve(initData);
  if (!r.ok) return { error: r.error };
  if (!r.profile) return { error: "Аккаунт не привязан." };

  const { data: t } = await r.admin
    .from("tickets")
    .select("id, company_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!t) return { error: "Заявка не найдена." };
  if (r.profile.role !== "admin" && t.company_id !== r.profile.company_id)
    return { error: "Нет доступа к заявке." };

  const path = buildStoragePath(ticketId, fileName);
  const { data, error } = await r.admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) return { error: "Не удалось подготовить загрузку." };
  return { path: data.path, token: data.token };
}

/** Запись о загруженном файле. */
export async function tgRegisterAttachment(
  initData: string,
  ticketId: number,
  input: { type: AttachmentType; name: string; storagePath: string; size: number }
): Promise<{ error?: string }> {
  const r = await resolve(initData);
  if (!r.ok) return { error: r.error };
  if (!r.profile) return { error: "Аккаунт не привязан." };

  const { error } = await r.admin.from("ticket_attachments").insert({
    ticket_id: ticketId,
    type: input.type,
    name: input.name,
    storage_path: input.storagePath,
    size_bytes: input.size,
  });

  if (error) return { error: "Не удалось прикрепить файл." };
  return {};
}

/** Удаление вложения: админ — всегда, клиент — пока заявка «Новая». */
export async function tgDeleteAttachment(
  initData: string,
  attachmentId: string
): Promise<{ error?: string }> {
  const r = await resolve(initData);
  if (!r.ok) return { error: r.error };
  if (!r.profile) return { error: "Аккаунт не привязан." };

  const { data: a } = await r.admin
    .from("ticket_attachments")
    .select("id, storage_path, ticket_id, tickets(status, company_id)")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!a) return { error: "Вложение не найдено." };

  const t = one<{ status: string; company_id: string | null }>(
    (a as { tickets?: unknown }).tickets as never
  );

  if (r.profile.role !== "admin") {
    if (!t || t.company_id !== r.profile.company_id)
      return { error: "Нет доступа к заявке." };
    if (t.status !== "Новая")
      return { error: "Заявка уже в работе — вложения изменить нельзя." };
  }

  if (a.storage_path) {
    await r.admin.storage.from(BUCKET).remove([a.storage_path]);
  }

  const { error } = await r.admin
    .from("ticket_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) return { error: "Не удалось удалить вложение." };
  return {};
}

/**
 * Сохранение телефона из Mini App.
 * Должность здесь не спрашиваем — её указывают при регистрации на сайте.
 */
export async function tgSavePhone(
  initData: string,
  phoneRaw: string
): Promise<{ error?: string }> {
  const r = await resolve(initData);
  if (!r.ok) return { error: r.error };
  if (!r.profile) return { error: "Аккаунт не привязан." };

  const phone = normalizeMdPhone(phoneRaw);
  if (!phone) return { error: `Неверный номер. ${MD_PHONE_HINT}` };

  const { error } = await r.admin
    .from("profiles")
    .update({ phone })
    .eq("id", r.profile.id);

  if (error) return { error: "Не удалось сохранить телефон." };
  return {};
}
