"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Logo } from "@/components/Logo";
import { VoiceInput } from "@/components/VoiceInput";
import { createClient } from "@/lib/supabase/client";
import {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  STATUS_COLORS,
  PRIORITY_COLORS,
  attachmentIcon,
  sourceBadge,
} from "@/lib/constants";
import {
  BUCKET,
  MAX_FILE_BYTES,
  attachmentTypeOf,
  humanSize,
} from "@/lib/attachments";
import { MD_PHONE_HINT } from "@/lib/phone";
import {
  tgLoad,
  tgLink,
  tgCreateTicket,
  tgUpdateTicket,
  tgAddComment,
  tgSetStatus,
  tgSetAssignee,
  tgCreateUpload,
  tgRegisterAttachment,
  tgSavePhone,
  tgUnlink,
  tgDeleteAttachment,
  tgSetEstimate,
  tgApproveTicket,
  tgRejectTicket,
  tgOcrAttachment,
  tgMarkRead,
  type TgState,
  type TgProfile,
} from "@/app/tg/actions";
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  Attachment,
} from "@/lib/types";

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  /** Появился в Bot API 6.9 — просит у пользователя разрешение отдать номер. */
  requestContact?: (cb: (granted: boolean, res?: unknown) => void) => void;
};

function pick(o: unknown, key: string): unknown {
  return o && typeof o === "object"
    ? (o as Record<string, unknown>)[key]
    : undefined;
}

/**
 * Достаёт номер из ответа requestContact.
 * Формат ответа менялся между версиями Telegram, поэтому пробуем варианты
 * и спокойно возвращаем null, если ничего не подошло.
 */
function extractPhone(res: unknown): string | null {
  const candidates = [
    pick(pick(pick(res, "responseUnsafe"), "contact"), "phone_number"),
    pick(pick(res, "contact"), "phone_number"),
    pick(res, "phone_number"),
  ];
  for (const c of candidates) if (typeof c === "string" && c) return c;

  const resp = pick(res, "response");
  if (typeof resp === "string") {
    try {
      const contact = new URLSearchParams(resp).get("contact");
      if (contact) {
        const parsed = JSON.parse(contact) as { phone_number?: string };
        if (parsed.phone_number) return parsed.phone_number;
      }
    } catch {
      /* формат не подошёл — вводят вручную */
    }
  }
  return null;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const inputCls =
  "w-full rounded-xl border-[1.5px] border-[#dde9e5] bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-brand";

/** Загружает файлы в хранилище и привязывает их к заявке. */
async function uploadFiles(
  initData: string,
  ticketId: number,
  files: File[],
  onError: (m: string) => void
) {
  const supabase = createClient();
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      onError(`«${file.name}» больше 20 МБ`);
      continue;
    }
    const prep = await tgCreateUpload(initData, ticketId, file.name);
    if (prep.error || !prep.path || !prep.token) {
      onError(prep.error ?? "Не удалось подготовить загрузку");
      continue;
    }
    const { error } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(prep.path, prep.token, file);
    if (error) {
      onError(`Не удалось загрузить «${file.name}»`);
      continue;
    }
    await tgRegisterAttachment(initData, ticketId, {
      type: attachmentTypeOf(file.type),
      name: file.name,
      storagePath: prep.path,
      size: file.size,
    });
  }
}

export function TgApp() {
  const [initData, setInitData] = useState<string | null>(null);
  const [outside, setOutside] = useState(false);
  const [state, setState] = useState<TgState | null>(null);
  const [screen, setScreen] = useState<"list" | "new" | "detail">("list");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa || !wa.initData) {
      setOutside(true);
      return;
    }
    wa.ready();
    wa.expand();
    setInitData(wa.initData);
  }, []);

  const reload = useCallback(async (data: string) => {
    setState(await tgLoad(data));
  }, []);

  useEffect(() => {
    if (initData) void reload(initData);
  }, [initData, reload]);

  if (outside) {
    return (
      <Shell>
        <div className="rounded-2xl border border-line bg-white p-6 text-center">
          <div className="mb-2 text-lg font-extrabold">Откройте в Telegram</div>
          <p className="text-sm text-muted">
            Это приложение работает внутри Telegram. Найдите нашего бота и
            нажмите кнопку «Заявки».
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white"
          >
            Перейти на сайт
          </a>
        </div>
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell>
        <div className="py-16 text-center text-sm text-muted">Загрузка…</div>
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <div className="rounded-2xl bg-[#fbe3e3] p-5 text-center text-sm font-semibold text-[#d64545]">
          {state.message}
        </div>
      </Shell>
    );
  }

  if (state.status === "not_linked") {
    return (
      <Shell>
        <LinkForm
          initData={initData!}
          onLinked={() => initData && reload(initData)}
        />
      </Shell>
    );
  }

  const { profile, tickets, team, voiceEnabled, reads } = state;
  const openTicket = tickets.find((t) => t.id === openId) ?? null;
  const isAdmin = profile.role === "admin";

  // Просим только телефон — должность указывается при регистрации на сайте
  if (!profile.phone) {
    return (
      <Shell>
        <PhoneSetupForm
          initData={initData!}
          onSaved={() => initData && reload(initData)}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-extrabold">
            {profile.full_name ?? "Клиент"}
            {isAdmin && (
              <span className="ml-1.5 rounded-full bg-mint px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                АДМИН
              </span>
            )}
          </div>
          <div className="truncate text-xs text-muted">
            {profile.company_name}
            {profile.position ? ` · ${profile.position}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {screen === "list" ? (
            <button
              onClick={() => setScreen("new")}
              className="rounded-full bg-brand px-4 py-2 text-[13px] font-bold text-white"
            >
              + Заявка
            </button>
          ) : (
            <button
              onClick={() => {
                setScreen("list");
                setOpenId(null);
              }}
              className="rounded-full border-[1.5px] border-[#dde9e5] px-4 py-2 text-[13px] font-bold text-slate"
            >
              ← Назад
            </button>
          )}
          <UnlinkButton
            initData={initData!}
            onDone={() => {
              setScreen("list");
              setOpenId(null);
              if (initData) void reload(initData);
            }}
          />
        </div>
      </div>

      {screen === "new" && (
        <NewTicketForm
          initData={initData!}
          voiceEnabled={voiceEnabled}
          onDone={async () => {
            setScreen("list");
            if (initData) await reload(initData);
          }}
        />
      )}

      {screen === "detail" && openTicket && (
        <TicketDetail
          initData={initData!}
          ticket={openTicket}
          profile={profile}
          team={team}
          voiceEnabled={voiceEnabled}
          onChanged={() => initData && reload(initData)}
        />
      )}

      {screen === "list" && (
        <TicketList
          tickets={tickets}
          isAdmin={isAdmin}
          myId={profile.id}
          reads={reads}
          onOpen={(id) => {
            setOpenId(id);
            setScreen("detail");
            void tgMarkRead(initData!, id);
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas px-4 py-4">
      <div className="mx-auto max-w-[520px]">
        <div className="mb-4 flex items-center gap-2.5">
          <Logo size={32} />
          <div className="leading-tight">
            <div className="text-[13px] font-extrabold">GSM Developer</div>
            <div className="text-[9px] font-semibold tracking-[1.5px] text-muted">
              ЗАЯВКИ 1С
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Выход из аккаунта в Mini App — снимает привязку Telegram к профилю. */
function UnlinkButton({
  initData,
  onDone,
}: {
  initData: string;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title="Выйти из аккаунта"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            "Выйти из аккаунта? Заявки останутся, при следующем входе нужно будет ввести email и пароль."
          )
        )
          return;
        startTransition(async () => {
          const res = await tgUnlink(initData);
          if (res.error) alert(res.error);
          else onDone();
        });
      }}
      className="rounded-full border-[1.5px] border-[#dde9e5] px-3 py-2 text-[13px] font-bold text-slate disabled:opacity-50"
    >
      {pending ? "…" : "Выйти"}
    </button>
  );
}

function PhoneSetupForm({
  initData,
  onSaved,
}: {
  initData: string;
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Telegram отдаёт номер только с явного согласия — показываем системный запрос
  const grabFromTelegram = () => {
    const wa = window.Telegram?.WebApp;
    if (!wa?.requestContact) {
      setHint("Ваша версия Telegram не умеет делиться номером — введите вручную.");
      return;
    }
    wa.requestContact((granted, res) => {
      if (!granted) {
        setHint("Доступ не выдан — введите номер вручную.");
        return;
      }
      const got = extractPhone(res);
      if (got) {
        setPhone(got);
        setHint("Номер получен из Telegram — проверьте и сохраните.");
      } else {
        setHint("Не удалось получить номер автоматически — введите вручную.");
      }
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await tgSavePhone(initData, phone);
      if (res.error) setError(res.error);
      else onSaved();
    });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-1 text-lg font-extrabold">Укажите телефон</div>
      <p className="mb-4 text-sm text-muted">
        Заполняется один раз — нужен для связи по заявкам.
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">Телефон</label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="+373 69 123 456"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
          />
          <button
            type="button"
            onClick={grabFromTelegram}
            className="mt-2 w-full rounded-xl border-[1.5px] border-[#b7d5cd] bg-[#f4f9f7] py-2.5 text-[13px] font-bold text-brand-dark"
          >
            📱 Взять номер из Telegram
          </button>
          <p className="mt-1 text-[11px] text-muted">{hint ?? MD_PHONE_HINT}</p>
        </div>
        {error && (
          <div className="rounded-lg bg-[#fbe3e3] px-3 py-2 text-sm font-semibold text-[#d64545]">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}

function LinkForm({
  initData,
  onLinked,
}: {
  initData: string;
  onLinked: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await tgLink(initData, email, password);
      if (res.error) setError(res.error);
      else onLinked();
    });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-1 text-lg font-extrabold">Привязка аккаунта</div>
      <p className="mb-4 text-sm text-muted">
        Войдите один раз — дальше приложение будет открываться сразу.
      </p>
      <div className="flex flex-col gap-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
        {error && (
          <div className="rounded-lg bg-[#fbe3e3] px-3 py-2 text-sm font-semibold text-[#d64545]">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Проверяем…" : "Привязать"}
        </button>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Нет аккаунта? Зарегистрируйтесь на сайте gsm-sait.vercel.app, затем
        вернитесь сюда.
      </p>
    </form>
  );
}

function TicketList({
  tickets,
  isAdmin,
  myId,
  reads,
  onOpen,
}: {
  tickets: Ticket[];
  isAdmin: boolean;
  myId: string;
  reads: Record<number, string>;
  onOpen: (id: number) => void;
}) {
  if (!tickets.length) {
    return (
      <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-[#9db3ac]">
        Заявок пока нет.
        <br />
        Нажмите «+ Заявка», чтобы создать первую.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {tickets.map((t) => (
        <button
          key={t.id}
          onClick={() => onOpen(t.id)}
          className="rounded-2xl border border-line bg-white p-4 text-left active:border-brand"
        >
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <div className="text-[15px] font-bold">{t.title}</div>
            <Badge kind="status" value={t.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="font-bold text-[#9db3ac]">#{t.id}</span>
            {isAdmin && t.company?.name && <span>{t.company.name}</span>}
            <span>{t.category}</span>
            <Badge kind="priority" value={t.priority} small />
            <SourceBadge source={t.source} />
            {(t.ticket_attachments?.length ?? 0) > 0 && (
              <span>📎 {t.ticket_attachments!.length}</span>
            )}
            {(() => {
              const all = t.ticket_comments ?? [];
              const lastRead = reads[t.id];
              const unread = all.filter(
                (c) =>
                  c.author_id !== myId && (!lastRead || c.created_at > lastRead)
              ).length;
              if (!all.length) return null;
              return unread > 0 ? (
                <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                  💬 {all.length} · +{unread}
                </span>
              ) : (
                <span>💬 {all.length}</span>
              );
            })()}
          </div>
        </button>
      ))}
    </div>
  );
}

function TicketDetail({
  initData,
  ticket,
  profile,
  team,
  voiceEnabled,
  onChanged,
}: {
  initData: string;
  ticket: Ticket;
  profile: TgProfile;
  team: string[];
  voiceEnabled: boolean;
  onChanged: () => void;
}) {
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile.role === "admin";
  const isAuthor = ticket.author_id === profile.id;
  // Админ правит всегда, клиент — только свою заявку и пока она «Новая»
  const canEdit = isAdmin || (ticket.status === "Новая" && isAuthor);
  const canDeleteFiles = canEdit;
  const needsApproval = !isAdmin && isAuthor && ticket.status === "На утверждении";

  const comments = [...(ticket.ticket_comments ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );
  const attachments = ticket.ticket_attachments ?? [];

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    startTransition(async () => {
      await tgAddComment(initData, ticket.id, text);
      setComment("");
      onChanged();
    });
  };

  const attach = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    startTransition(async () => {
      await uploadFiles(initData, ticket.id, Array.from(files), setError);
      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    });
  };

  if (editing) {
    return (
      <TicketForm
        title="Изменить заявку"
        initial={ticket}
        pendingLabel="Сохраняем…"
        submitLabel="Сохранить"
        voiceEnabled={voiceEnabled}
        initData={initData}
        onCancel={() => setEditing(false)}
        onSubmit={async (v) => {
          const res = await tgUpdateTicket(initData, ticket.id, v);
          if (res.error) return res.error;
          setEditing(false);
          onChanged();
          return null;
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="text-[16px] font-extrabold">{ticket.title}</div>
          <Badge kind="status" value={ticket.status} />
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-bold text-[#9db3ac]">#{ticket.id}</span>
          {isAdmin && ticket.company?.name && <span>{ticket.company.name}</span>}
          <span>{ticket.category}</span>
          <Badge kind="priority" value={ticket.priority} small />
          <SourceBadge source={ticket.source} />
        </div>
        <div className="mb-3 text-xs text-muted">
          Автор: {ticket.author?.full_name ?? "—"}
          {ticket.author?.telegram_username
            ? ` · @${ticket.author.telegram_username}`
            : ""}
          {" · "}Исполнитель: {ticket.assignee}
        </div>
        {ticket.description && (
          <p className="mb-3 text-sm leading-relaxed text-[#2b3d37]">
            {ticket.description}
          </p>
        )}

        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((a) => {
              const inner = (
                <>
                  {attachmentIcon(a.type)} {a.name}
                  {a.size_bytes ? (
                    <span className="font-normal text-muted">
                      {humanSize(a.size_bytes)}
                    </span>
                  ) : null}
                </>
              );
              const cls =
                "flex items-center gap-1.5 rounded-[9px] border border-[#dde9e5] bg-[#f4f9f7] px-3 py-2 text-[13px] font-semibold";
              const href = a.signedUrl ?? a.url;
              return (
                <div key={a.id} className="flex items-stretch">
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className={cls}>
                      {inner}
                    </a>
                  ) : (
                    <span className={`${cls} opacity-60`}>{inner}</span>
                  )}
                  {canDeleteFiles && (
                    <button
                      type="button"
                      title="Удалить"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`Удалить «${a.name}»?`)) return;
                        startTransition(async () => {
                          const res = await tgDeleteAttachment(initData, a.id);
                          if (res.error) setError(res.error);
                          else onChanged();
                        });
                      }}
                      className="ml-1 rounded-[9px] border border-[#dde9e5] bg-white px-2 text-[13px] font-bold text-[#9db3ac] disabled:opacity-50"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isAdmin &&
          attachments
            .filter((a) => a.type === "image" && a.storage_path)
            .map((a) => (
              <TgOcrBlock key={a.id} initData={initData} attachment={a} />
            ))}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
            className="rounded-[10px] border-[1.5px] border-dashed border-[#b7d5cd] bg-[#f4f9f7] px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60"
          >
            {pending ? "Загружаем…" : "📎 Прикрепить файл"}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-3.5 py-2 text-[13px] font-semibold text-slate"
            >
              ✏️ Изменить
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => attach(e.target.files)}
          />
        </div>
        {!canEdit && (
          <p className="mt-2 text-[11px] text-muted">
            Заявка уже в работе — изменить её нельзя. Пишите в переписке.
          </p>
        )}
        {error && (
          <div className="mt-2 text-[12px] font-semibold text-[#d64545]">
            {error}
          </div>
        )}
      </div>

      {needsApproval && (
        <TgApprovalPanel
          initData={initData}
          ticketId={ticket.id}
          hours={ticket.estimate}
          voiceEnabled={voiceEnabled}
          onDone={onChanged}
        />
      )}

      {ticket.status === "Отклонена" && ticket.rejection_reason && (
        <div className="rounded-2xl border-[1.5px] border-[#f3c9c9] bg-[#fdf2f2] p-4">
          <div className="mb-1 text-[13px] font-extrabold text-[#d64545]">
            Заявка отклонена клиентом
          </div>
          <div className="text-sm leading-snug text-[#2b3d37]">
            {ticket.rejection_reason}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="rounded-2xl border-[1.5px] border-[#cbe6e0] bg-[#f4f9f7] p-4">
          <div className="mb-3 text-[13px] font-extrabold text-brand-dark">
            Панель администратора
          </div>

          <div className="mb-1.5 text-xs font-bold text-muted">
            Оценка работ, часов
          </div>
          <TgEstimateControl
            initData={initData}
            ticketId={ticket.id}
            current={ticket.estimate}
            onDone={onChanged}
          />

          <div className="mb-1.5 mt-3.5 text-xs font-bold text-muted">Статус</div>
          <div className="mb-3.5 flex flex-wrap gap-2">
            {STATUSES.map((s) => {
              const active = ticket.status === s;
              return (
                <button
                  key={s}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await tgSetStatus(initData, ticket.id, s as TicketStatus);
                      onChanged();
                    })
                  }
                  className="rounded-[9px] px-3 py-2 text-[13px] font-bold disabled:opacity-50"
                  style={{
                    border: `1.5px solid ${active ? "#0f9d8c" : "#dde9e5"}`,
                    background: active ? "#d6f0eb" : "#fff",
                    color: active ? "#0c7d70" : "#42574f",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <div className="mb-1.5 text-xs font-bold text-muted">Исполнитель</div>
          <select
            defaultValue={ticket.assignee}
            disabled={pending}
            onChange={(e) =>
              startTransition(async () => {
                await tgSetAssignee(initData, ticket.id, e.target.value);
                onChanged();
              })
            }
            className={inputCls}
          >
            {(team.length ? team : ["—"]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-2.5 text-[13px] font-extrabold">Переписка</div>
        <div className="mb-3 flex flex-col gap-2">
          {comments.length === 0 && (
            <div className="text-[13px] text-muted">Сообщений пока нет.</div>
          )}
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-xl px-3 py-2"
              style={{
                background: c.is_client ? "#eaf6f3" : "#f4f9f7",
                border: `1px solid ${c.is_client ? "#cbe6e0" : "#e6efec"}`,
              }}
            >
              <div className="mb-0.5 flex justify-between gap-2">
                <b className="text-[13px]">{c.author_name}</b>
                <span className="text-[11px] text-[#9db3ac]">
                  {new Date(c.created_at).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="text-sm leading-snug text-[#2b3d37]">{c.body}</div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Сообщение…"
            className={inputCls}
          />
          {voiceEnabled && (
            <VoiceInput
              compact
              initData={initData}
              onText={(text) =>
                setComment((c) => (c ? `${c} ${text}` : text))
              }
            />
          )}
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-xl bg-ink px-4 font-bold text-white disabled:opacity-50"
          >
            →
          </button>
        </form>
      </div>
    </div>
  );
}

/** Распознавание текста с картинки в Mini App — только у админа. */
function TgOcrBlock({
  initData,
  attachment,
}: {
  initData: string;
  attachment: Attachment;
}) {
  const [text, setText] = useState<string | null | undefined>(attachment.ocr_text);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (text === null || text === undefined) {
    return (
      <div className="mb-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await tgOcrAttachment(initData, attachment.id);
              if (res.error) setError(res.error);
              else {
                setText(res.text ?? "");
                setOpen(true);
              }
            });
          }}
          className="w-full rounded-[10px] border-[1.5px] border-dashed border-[#b7d5cd] bg-[#f4f9f7] px-3 py-2 text-[12px] font-semibold text-brand-dark disabled:opacity-60"
        >
          {pending ? "Распознаём…" : `📄 Распознать текст · ${attachment.name}`}
        </button>
        {error && (
          <div className="mt-1 text-[12px] font-semibold text-[#d64545]">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (!text) {
    return (
      <div className="mb-3 text-[12px] text-[#9db3ac]">
        📄 {attachment.name}: читаемого текста не найдено
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-[10px] border border-line bg-[#f9fcfb] p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left text-[12px] font-bold text-brand-dark"
      >
        <span className="truncate">📄 Текст с картинки</span>
        <span className="text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-[13px] leading-snug text-[#2b3d37]">
          {text}
        </pre>
      )}
    </div>
  );
}

/** Админ ставит оценку часов — заявка уходит клиенту на утверждение. */
function TgEstimateControl({
  initData,
  ticketId,
  current,
  onDone,
}: {
  initData: string;
  ticketId: number;
  current: number | null;
  onDone: () => void;
}) {
  const [hours, setHours] = useState(current != null ? String(current) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          inputMode="numeric"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="напр. 8"
          className={inputCls}
        />
        <button
          type="button"
          disabled={pending || !hours.trim()}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await tgSetEstimate(initData, ticketId, hours);
              if (res.error) setError(res.error);
              else onDone();
            });
          }}
          className="shrink-0 rounded-xl bg-brand px-4 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "…" : "Отправить"}
        </button>
      </div>
      {error && (
        <div className="mt-1.5 text-[12px] font-semibold text-[#d64545]">{error}</div>
      )}
    </>
  );
}

/** Плашка автора: утвердить оценку или отклонить с причиной. */
function TgApprovalPanel({
  initData,
  ticketId,
  hours,
  voiceEnabled,
  onDone,
}: {
  initData: string;
  ticketId: number;
  hours: number | null;
  voiceEnabled: boolean;
  onDone: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else onDone();
    });
  };

  return (
    <div className="rounded-2xl border-[1.5px] border-[#e8d2a6] bg-[#fdf8ee] p-4">
      <div className="mb-1 text-[13px] font-extrabold text-[#c47d17]">
        Требуется ваше решение
      </div>
      <p className="mb-3 text-sm text-[#2b3d37]">
        Оценка работ: <b>{hours ?? "—"} ч</b>. Подтвердите сроки или отклоните,
        указав причину.
      </p>

      {!rejecting ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => tgApproveTicket(initData, ticketId))}
            className="rounded-xl bg-brand py-3 text-[15px] font-bold text-white disabled:opacity-60"
          >
            {pending ? "Отправляем…" : "✓ Утвердить"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="rounded-xl border-[1.5px] border-[#dde9e5] bg-white py-3 text-[15px] font-bold text-[#d64545] disabled:opacity-60"
          >
            ✕ Отклонить
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Причина отклонения (обязательно)"
            className={`${inputCls} resize-none`}
          />
          {voiceEnabled && (
            <VoiceInput
              initData={initData}
              label="Продиктовать причину"
              onText={(text) => setReason((r) => (r ? `${r} ${text}` : text))}
            />
          )}
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() => run(() => tgRejectTicket(initData, ticketId, reason))}
            className="rounded-xl bg-[#d64545] py-3 text-[15px] font-bold text-white disabled:opacity-50"
          >
            {pending ? "Отправляем…" : "Отклонить заявку"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setRejecting(false);
              setReason("");
            }}
            className="rounded-xl border-[1.5px] border-[#dde9e5] bg-white py-2.5 text-[13px] font-bold text-slate"
          >
            Назад
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg bg-[#fbe3e3] px-3 py-2 text-sm font-semibold text-[#d64545]">
          {error}
        </div>
      )}
    </div>
  );
}

type FormValues = {
  title: string;
  category: string;
  priority: string;
  description: string;
  deadline: string;
};

function TicketForm({
  title: heading,
  initial,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
  extra,
  voiceEnabled,
  initData,
}: {
  title: string;
  initial?: Partial<Ticket>;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (v: FormValues) => Promise<string | null>;
  onCancel?: () => void;
  extra?: React.ReactNode;
  voiceEnabled?: boolean;
  initData?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<string>(initial?.category ?? "Доработка");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "Средний");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const err = await onSubmit({
        title,
        category,
        priority,
        description,
        deadline,
      });
      if (err) setError(err);
    });
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5"
    >
      <div className="text-lg font-extrabold">{heading}</div>
      <div>
        <label className="mb-1.5 block text-[13px] font-bold">Заголовок *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Кратко о задаче"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-bold">Категория</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputCls}
        >
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-bold">Приоритет</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={inputCls}
        >
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-bold">
          Желаемая дата исполнения
        </label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-bold">Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Опишите, что нужно сделать"
          className={`${inputCls} resize-none`}
        />
        {voiceEnabled && initData && (
          <VoiceInput
            initData={initData}
            onText={(text) =>
              setDescription((d) => (d ? `${d} ${text}` : text))
            }
          />
        )}
      </div>
      {extra}
      {error && (
        <div className="rounded-lg bg-[#fbe3e3] px-3 py-2 text-sm font-semibold text-[#d64545]">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border-[1.5px] border-[#dde9e5] py-3 text-[15px] font-bold text-slate"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

function NewTicketForm({
  initData,
  voiceEnabled,
  onDone,
}: {
  initData: string;
  voiceEnabled: boolean;
  onDone: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <TicketForm
      title="Новая заявка"
      submitLabel="Создать заявку"
      pendingLabel="Отправляем…"
      voiceEnabled={voiceEnabled}
      initData={initData}
      onSubmit={async (v) => {
        const res = await tgCreateTicket(initData, v);
        if (res.error || !res.ticketId) return res.error ?? "Не удалось создать заявку.";
        if (files.length) {
          await uploadFiles(initData, res.ticketId, files, () => {});
        }
        onDone();
        return null;
      }}
      extra={
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">Вложения</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-[10px] border-[1.5px] border-dashed border-[#b7d5cd] bg-[#f4f9f7] px-4 py-2.5 text-[13px] font-semibold"
          >
            📎 Выбрать файлы
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const list = e.target.files;
              if (list?.length) setFiles((f) => [...f, ...Array.from(list)]);
            }}
          />
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="flex items-center gap-1.5 rounded-lg bg-mint px-3 py-1.5 text-[13px] font-semibold text-brand-dark"
                >
                  {attachmentTypeOf(f.type) === "image" ? "🖼" : "📎"} {f.name}
                  <span className="opacity-60">✕</span>
                </button>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

function SourceBadge({ source }: { source: Ticket["source"] }) {
  const s = sourceBadge(source);
  if (!s) return null;
  return (
    <span
      style={{ background: s.bg, color: s.fg }}
      className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"
    >
      {s.text}
    </span>
  );
}

function Badge({
  kind,
  value,
  small,
}: {
  kind: "status" | "priority";
  value: string;
  small?: boolean;
}) {
  const map =
    kind === "status"
      ? STATUS_COLORS[value as TicketStatus]
      : PRIORITY_COLORS[value as TicketPriority];
  const [color, bg] = map ?? ["#6f887f", "#e7eeeb"];
  return (
    <span
      style={{ background: bg, color }}
      className={`shrink-0 whitespace-nowrap rounded-full font-bold ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      {value}
    </span>
  );
}
