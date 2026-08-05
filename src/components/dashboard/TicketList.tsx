"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  STATUSES,
  STATUS_COLORS,
  PRIORITY_COLORS,
  CATEGORIES,
  PRIORITIES,
  TEAM,
  sourceBadge,
} from "@/lib/constants";
import {
  changeStatus,
  changeAssignee,
  addComment,
  updateTicket,
  setEstimate,
  approveTicket,
  rejectTicket,
} from "@/app/dashboard/actions";
import { AttachmentChips, AddAttachment } from "./AttachmentChips";
import type { Ticket, TicketStatus } from "@/lib/types";

/** Ввод оценки часов админом — отправляет заявку клиенту на утверждение. */
function EstimateControl({
  ticketId,
  current,
  onDone,
}: {
  ticketId: number;
  current: number | null;
  onDone: () => void;
}) {
  const [hours, setHours] = useState(current != null ? String(current) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await setEstimate(ticketId, hours);
      if (res.error) setError(res.error);
      else onDone();
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          min="1"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="напр. 8"
          className="w-32 rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        <button
          disabled={pending || !hours.trim()}
          onClick={save}
          className="rounded-[10px] bg-brand px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Сохраняем…" : "Отправить на утверждение"}
        </button>
      </div>
      {error && (
        <div className="mt-1.5 text-[12px] font-semibold text-[#d64545]">{error}</div>
      )}
    </>
  );
}

/** Плашка для автора: согласиться с оценкой или отклонить с причиной. */
function ApprovalPanel({
  ticketId,
  hours,
  onDone,
}: {
  ticketId: number;
  hours: number | null;
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
    <div className="mb-4 rounded-[14px] border-[1.5px] border-[#e8d2a6] bg-[#fdf8ee] p-4">
      <div className="mb-1 text-[13px] font-extrabold text-[#c47d17]">
        Требуется ваше решение
      </div>
      <p className="mb-3 text-sm text-[#2b3d37]">
        Оценка работ: <b>{hours ?? "—"} ч</b>. Подтвердите сроки или отклоните,
        указав причину.
      </p>

      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={pending}
            onClick={() => run(() => approveTicket(ticketId))}
            className="rounded-[10px] bg-brand px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {pending ? "Отправляем…" : "✓ Утвердить"}
          </button>
          <button
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-5 py-2.5 text-[13px] font-bold text-[#d64545] disabled:opacity-60"
          >
            ✕ Отклонить
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Причина отклонения (обязательно) — например: задача уже неактуальна"
            className="w-full resize-none rounded-[11px] border-[1.5px] border-[#dde9e5] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand"
          />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending || !reason.trim()}
              onClick={() => run(() => rejectTicket(ticketId, reason))}
              className="rounded-[10px] bg-[#d64545] px-5 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              {pending ? "Отправляем…" : "Отклонить заявку"}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
              className="rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-4 py-2.5 text-[13px] font-bold text-slate"
            >
              Назад
            </button>
          </div>
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

function TicketEditForm({
  t,
  isAdmin,
  onCancel,
  onSaved,
}: {
  t: Ticket;
  isAdmin: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(t.title);
  const [category, setCategory] = useState<string>(t.category);
  const [priority, setPriority] = useState<string>(t.priority);
  const [description, setDescription] = useState(t.description ?? "");
  const [deadline, setDeadline] = useState(t.deadline ?? "");
  const [estimate, setEstimateValue] = useState(
    t.estimate != null ? String(t.estimate) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cls =
    "w-full rounded-[11px] border-[1.5px] border-[#dde9e5] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateTicket(t.id, {
        title,
        category,
        priority,
        description,
        deadline,
        estimate,
      });
      if (res.error) setError(res.error);
      else onSaved();
    });
  };

  return (
    <form
      onSubmit={submit}
      className="mb-4 flex flex-col gap-3 rounded-[14px] border-[1.5px] border-[#cbe6e0] bg-[#f9fcfb] p-4"
    >
      <div className="text-[13px] font-extrabold text-brand-dark">
        Редактирование заявки
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Заголовок"
        className={cls}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={cls}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={cls}>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold text-muted">
          Желаемая дата исполнения
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className={cls}
          />
        </label>
        {isAdmin && (
          <label className="text-[12px] font-semibold text-muted">
            Оценка работ, часов
            <input
              type="number"
              min="0"
              value={estimate}
              onChange={(e) => setEstimateValue(e.target.value)}
              className={cls}
            />
          </label>
        )}
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Описание"
        className={`${cls} resize-none`}
      />
      {error && (
        <div className="rounded-lg bg-[#fbe3e3] px-3 py-2 text-sm font-semibold text-[#d64545]">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-4 py-2 text-[13px] font-bold"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-brand px-5 py-2 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}

function badge([c, b]: [string, string]): CSSProperties {
  return {
    background: b,
    color: c,
    fontWeight: 700,
    fontSize: 12,
    padding: "5px 12px",
    borderRadius: 99,
    whiteSpace: "nowrap",
  };
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU");
  } catch {
    return iso;
  }
}

function fmtDeadline(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return day && m && y ? `${day}.${m}.${y}` : d;
}

export function TicketList({
  tickets,
  isAdmin,
  myId,
}: {
  tickets: Ticket[];
  isAdmin: boolean;
  myId: string;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (!tickets.length) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-[#9db3ac]">
        Заявок нет
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tickets.map((t) => (
        <TicketCard
          key={t.id}
          t={t}
          isAdmin={isAdmin}
          myId={myId}
          expanded={expandedId === t.id}
          onToggle={() =>
            setExpandedId((cur) => (cur === t.id ? null : t.id))
          }
        />
      ))}
    </div>
  );
}

function TicketCard({
  t,
  isAdmin,
  myId,
  expanded,
  onToggle,
}: {
  t: Ticket;
  isAdmin: boolean;
  myId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  const isAuthor = t.author_id === myId;
  // Админ правит всегда, клиент — только свою заявку и пока она «Новая»
  const canEdit = isAdmin || (t.status === "Новая" && isAuthor);
  const canDeleteFiles = canEdit;
  // Автор решает судьбу оценки
  const needsApproval = !isAdmin && isAuthor && t.status === "На утверждении";

  const prioStyle =
    PRIORITY_COLORS[t.priority] ?? (["#4a5f57", "#e7eeeb"] as [string, string]);
  const statusStyle =
    STATUS_COLORS[t.status] ?? (["#6f887f", "#e7eeeb"] as [string, string]);

  const authorName = t.author?.full_name ?? "—";
  const authorNick = t.author?.telegram_username ?? null;
  const src = sourceBadge(t.source);
  const companyName = t.company?.name ?? "—";
  const attachments = t.ticket_attachments ?? [];
  const comments = [...(t.ticket_comments ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  const meta = [
    { k: "Категория", v: t.category },
    { k: "Желаемая дата", v: fmtDeadline(t.deadline) },
    { k: "Оценка работ", v: t.estimate ? `${t.estimate} ч` : "—" },
    { k: "Исполнитель", v: t.assignee },
  ];

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    startTransition(async () => {
      await addComment(t.id, text);
      setComment("");
    });
  };

  return (
    <div
      className="overflow-hidden rounded-[18px] bg-white transition"
      style={{ border: `1.5px solid ${expanded ? "#0f9d8c" : "#e6efec"}` }}
    >
      {/* Заголовок карточки */}
      <div
        onClick={onToggle}
        className="grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-[22px] py-[18px] sm:grid-cols-[56px_1fr_auto_auto] sm:gap-4"
      >
        <span className="text-sm font-extrabold text-[#9db3ac]">#{t.id}</span>
        <div>
          <div className="text-base font-bold">{t.title}</div>
          <div className="mt-[3px] flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>
              {companyName} · {authorName}
              {authorNick ? ` · @${authorNick}` : ""} · {fmtDate(t.created_at)}
            </span>
            {src && (
              <span
                style={{ background: src.bg, color: src.fg }}
                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              >
                {src.text}
              </span>
            )}
          </div>
        </div>
        <span style={badge(prioStyle)} className="hidden sm:inline">
          {t.priority}
        </span>
        <span style={badge(statusStyle)}>{t.status}</span>
      </div>

      {/* Развёрнутая часть */}
      {expanded && (
        <div className="animate-expand border-t border-canvas px-[22px] pb-[22px] pt-1">
          <div className="my-[18px] grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {meta.map((m) => (
              <div key={m.k} className="rounded-[10px] bg-[#f4f9f7] p-3">
                <div className="mb-1 text-[11px] font-bold text-[#9db3ac]">{m.k}</div>
                <div className="text-[13px] font-bold">{m.v}</div>
              </div>
            ))}
          </div>

          {t.description && (
            <div className="mb-4 text-[15px] leading-[1.6] text-[#2b3d37]">
              {t.description}
            </div>
          )}

          {needsApproval && (
            <ApprovalPanel
              ticketId={t.id}
              hours={t.estimate}
              onDone={() => router.refresh()}
            />
          )}

          {t.status === "Отклонена" && t.rejection_reason && (
            <div className="mb-4 rounded-[14px] border-[1.5px] border-[#f3c9c9] bg-[#fdf2f2] p-4">
              <div className="mb-1 text-[13px] font-extrabold text-[#d64545]">
                Заявка отклонена клиентом
              </div>
              <div className="text-sm leading-[1.5] text-[#2b3d37]">
                {t.rejection_reason}
              </div>
              {isAdmin && (
                <div className="mt-2 text-[12px] text-muted">
                  Измените оценку часов ниже — заявка снова уйдёт на утверждение.
                </div>
              )}
            </div>
          )}

          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="mb-4 rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-4 py-2 text-[13px] font-bold text-slate transition hover:border-brand hover:text-brand"
            >
              ✏️ Изменить заявку
            </button>
          )}
          {!canEdit && !isAdmin && (
            <div className="mb-4 text-[12px] text-muted">
              Заявка уже в работе — изменить её нельзя. Уточнения пишите в переписке.
            </div>
          )}

          <AttachmentChips
            items={attachments}
            canDelete={canDeleteFiles}
            onDeleted={() => router.refresh()}
          />
          {canEdit && (
            <AddAttachment
              ticketId={t.id}
              onDone={() => startTransition(async () => { router.refresh(); })}
            />
          )}

          {editing && (
            <TicketEditForm
              t={t}
              isAdmin={isAdmin}
              onCancel={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                router.refresh();
              }}
            />
          )}

          {/* Панель администратора */}
          {isAdmin && (
            <div className="mb-4 rounded-[14px] border-[1.5px] border-[#cbe6e0] bg-[#f4f9f7] p-4">
              <div className="mb-3 text-[13px] font-extrabold text-brand-dark">
                Панель администратора
              </div>
              <div className="mb-1.5 text-xs font-bold text-muted">Статус</div>
              <div className="mb-3.5 flex flex-wrap gap-2">
                {STATUSES.map((s) => {
                  const active = t.status === s;
                  return (
                    <button
                      key={s}
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await changeStatus(t.id, s as TicketStatus);
                        })
                      }
                      className="rounded-[9px] px-3 py-2 text-[13px] font-bold transition disabled:opacity-50"
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
              <div className="mb-1.5 text-xs font-bold text-muted">
                Оценка работ, часов
              </div>
              <EstimateControl
                ticketId={t.id}
                current={t.estimate}
                onDone={() => router.refresh()}
              />

              <div className="mb-1.5 mt-3.5 text-xs font-bold text-muted">
                Исполнитель
              </div>
              <select
                defaultValue={t.assignee}
                disabled={pending}
                onChange={(e) =>
                  startTransition(async () => {
                    await changeAssignee(t.id, e.target.value);
                  })
                }
                className="w-full rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand"
              >
                {TEAM.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Переписка */}
          <div className="mb-2.5 text-[13px] font-extrabold">Переписка</div>
          <div className="mb-3 flex flex-col gap-2.5">
            {comments.length === 0 && (
              <div className="text-[13px] text-muted">Сообщений пока нет.</div>
            )}
            {comments.map((c) => (
              <div
                key={c.id}
                className="rounded-xl px-3 py-2.5"
                style={{
                  background: c.is_client ? "#eaf6f3" : "#f4f9f7",
                  border: `1px solid ${c.is_client ? "#cbe6e0" : "#e6efec"}`,
                }}
              >
                <div className="mb-1 flex justify-between">
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
                <div className="text-sm leading-[1.5] text-[#2b3d37]">{c.body}</div>
              </div>
            ))}
          </div>
          <form onSubmit={submitComment} className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Написать комментарий…"
              className="flex-1 rounded-[10px] border-[1.5px] border-[#dde9e5] px-3.5 py-3 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-[10px] bg-ink px-5 font-bold text-white disabled:opacity-50"
            >
              →
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
