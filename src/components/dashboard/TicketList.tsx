"use client";

import { useState, useTransition, type CSSProperties } from "react";
import {
  STATUSES,
  STATUS_COLORS,
  PRIORITY_COLORS,
  TEAM,
  attachmentIcon,
} from "@/lib/constants";
import { changeStatus, changeAssignee, addComment } from "@/app/dashboard/actions";
import type { Ticket, TicketStatus } from "@/lib/types";

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
}: {
  tickets: Ticket[];
  isAdmin: boolean;
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
  expanded,
  onToggle,
}: {
  t: Ticket;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");

  const prioStyle =
    PRIORITY_COLORS[t.priority] ?? (["#4a5f57", "#e7eeeb"] as [string, string]);
  const statusStyle =
    STATUS_COLORS[t.status] ?? (["#6f887f", "#e7eeeb"] as [string, string]);

  const authorName = t.author?.full_name ?? "—";
  const companyName = t.company?.name ?? "—";
  const attachments = t.ticket_attachments ?? [];
  const comments = [...(t.ticket_comments ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
  );

  const meta = [
    { k: "Категория", v: t.category },
    { k: "Дедлайн", v: fmtDeadline(t.deadline) },
    { k: "Оценка", v: t.estimate ? `${t.estimate} ч` : "—" },
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
          <div className="mt-[3px] text-xs text-muted">
            {companyName} · {authorName} · {fmtDate(t.created_at)}
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

          {attachments.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {attachments.map((a) => {
                const chip = (
                  <span className="flex items-center gap-1.5 rounded-[9px] border border-[#dde9e5] bg-[#f4f9f7] px-3 py-2 text-[13px] font-semibold">
                    {attachmentIcon(a.type)} {a.name}
                  </span>
                );
                return a.url ? (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
                    {chip}
                  </a>
                ) : (
                  <div key={a.id}>{chip}</div>
                );
              })}
            </div>
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
              <div className="mb-1.5 text-xs font-bold text-muted">Исполнитель</div>
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
