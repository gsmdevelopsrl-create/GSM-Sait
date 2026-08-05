"use client";

import { STATUSES, STATUS_COLORS } from "@/lib/constants";
import type { Ticket, TicketStatus } from "@/lib/types";

export type Filters = {
  status: string; // "" = все
  company: string;
  assignee: string;
  query: string;
  onlyUnread: boolean;
};

export const EMPTY_FILTERS: Filters = {
  status: "",
  company: "",
  assignee: "",
  query: "",
  onlyUnread: false,
};

const selectCls =
  "rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-3 py-2 text-[13px] outline-none focus:border-brand";

/** Панель фильтров над таблицей заявок. */
export function TicketsFilters({
  tickets,
  isAdmin,
  value,
  onChange,
  total,
  shown,
}: {
  tickets: Ticket[];
  isAdmin: boolean;
  value: Filters;
  onChange: (f: Filters) => void;
  total: number;
  shown: number;
}) {
  const companies = Array.from(
    new Set(tickets.map((t) => t.company?.name).filter((n): n is string => !!n))
  ).sort();
  const assignees = Array.from(
    new Set(tickets.map((t) => t.assignee).filter((a) => a && a !== "—"))
  ).sort();

  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const dirty =
    value.status || value.company || value.assignee || value.query || value.onlyUnread;

  return (
    <div className="mb-4 flex flex-col gap-3">
      {/* Статусы — быстрым переключателем */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => set({ status: "" })}
          className="rounded-full px-3 py-1.5 text-[12px] font-bold transition"
          style={
            value.status === ""
              ? { background: "#152a24", color: "#fff" }
              : { background: "#fff", color: "#42574f", border: "1.5px solid #dde9e5" }
          }
        >
          Все
        </button>
        {STATUSES.map((s) => {
          const [color, bg] = STATUS_COLORS[s as TicketStatus];
          const active = value.status === s;
          const n = tickets.filter((t) => t.status === s).length;
          return (
            <button
              key={s}
              onClick={() => set({ status: active ? "" : s })}
              className="rounded-full px-3 py-1.5 text-[12px] font-bold transition"
              style={
                active
                  ? { background: color, color: "#fff" }
                  : { background: bg, color, opacity: n ? 1 : 0.45 }
              }
            >
              {s} {n > 0 && <span className="opacity-70">{n}</span>}
            </button>
          );
        })}
      </div>

      {/* Остальные фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={value.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Поиск по номеру, теме, описанию…"
          className={`${selectCls} min-w-[240px] flex-1`}
        />

        {isAdmin && companies.length > 1 && (
          <select
            value={value.company}
            onChange={(e) => set({ company: e.target.value })}
            className={selectCls}
          >
            <option value="">Все компании</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {assignees.length > 0 && (
          <select
            value={value.assignee}
            onChange={(e) => set({ assignee: e.target.value })}
            className={selectCls}
          >
            <option value="">Все исполнители</option>
            <option value="—">Без исполнителя</option>
            {assignees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => set({ onlyUnread: !value.onlyUnread })}
          className="rounded-[10px] px-3 py-2 text-[13px] font-bold transition"
          style={
            value.onlyUnread
              ? { background: "#0f9d8c", color: "#fff" }
              : { background: "#fff", color: "#42574f", border: "1.5px solid #dde9e5" }
          }
        >
          💬 Непрочитанные
        </button>

        {dirty && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="rounded-[10px] border-[1.5px] border-[#dde9e5] bg-white px-3 py-2 text-[13px] font-semibold text-muted"
          >
            Сбросить
          </button>
        )}

        <span className="ml-auto text-[13px] text-muted">
          {shown === total ? `Всего: ${total}` : `Показано ${shown} из ${total}`}
        </span>
      </div>
    </div>
  );
}
