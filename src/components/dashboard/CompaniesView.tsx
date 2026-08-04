"use client";

import { useEffect, useState } from "react";
import { STATUSES, STATUS_COLORS, initials } from "@/lib/constants";
import { CompanyModal } from "./CompanyModal";
import type { Ticket, TicketStatus } from "@/lib/types";

type Company = { id: string; name: string };
type Member = {
  id: string;
  full_name: string | null;
  position: string | null;
  role: string;
  company_id: string | null;
};
type ViewMode = "grid" | "list";

const VIEW_KEY = "gsm.companiesView";

export function CompaniesView({
  companies,
  tickets,
  members,
  onOpen,
}: {
  companies: Company[];
  tickets: Ticket[];
  members: Member[];
  onOpen: (name: string) => void;
}) {
  const [selected, setSelected] = useState<Company | null>(null);
  const [view, setView] = useState<ViewMode>("grid");

  // Запоминаем выбранный вид между визитами
  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY);
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);

  const changeView = (v: ViewMode) => {
    setView(v);
    window.localStorage.setItem(VIEW_KEY, v);
  };

  const rows = companies
    .map((c) => {
      const own = tickets.filter((t) => t.company?.name === c.name);
      const byStatus = Object.fromEntries(
        STATUSES.map((s) => [s, own.filter((t) => t.status === s).length])
      ) as Record<TicketStatus, number>;
      const staff = members.filter((m) => m.company_id === c.id).length;
      return { c, total: own.length, byStatus, staff };
    })
    .sort((a, b) => b.total - a.total);

  if (!rows.length) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-[#9db3ac]">
        Компаний пока нет
      </div>
    );
  }

  return (
    <>
      {/* Переключатель вида */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[13px] text-muted">
          Всего компаний: <b className="text-ink">{rows.length}</b>
        </div>
        <div className="flex gap-1 rounded-full border border-line bg-white p-1">
          <ViewButton
            active={view === "grid"}
            onClick={() => changeView("grid")}
            label="Плитка"
            icon={<GridIcon />}
          />
          <ViewButton
            active={view === "list"}
            onClick={() => changeView("list")}
            label="Список"
            icon={<ListIcon />}
          />
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {rows.map(({ c, total, byStatus, staff }) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="rounded-2xl border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_14px_30px_rgba(21,42,36,.08)]"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-sm font-bold text-brand-dark">
                  {initials(c.name.replace(/[«»"]/g, ""))}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-extrabold">{c.name}</div>
                  <div className="text-xs text-muted">
                    {total} {plural(total)} · {staff}{" "}
                    {staff === 1 ? "сотрудник" : "сотр."}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadges byStatus={byStatus} total={total} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {rows.map(({ c, total, byStatus, staff }, i) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f4f9f7]"
              style={{
                borderTop: i === 0 ? "none" : "1px solid #eef5f2",
              }}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mint text-[13px] font-bold text-brand-dark">
                {initials(c.name.replace(/[«»"]/g, ""))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold">{c.name}</div>
                <div className="text-xs text-muted">
                  {total} {plural(total)} · {staff}{" "}
                  {staff === 1 ? "сотрудник" : "сотр."}
                </div>
              </div>
              <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
                <StatusBadges byStatus={byStatus} total={total} />
              </div>
              <span className="shrink-0 pl-1 text-[#9db3ac]">›</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <CompanyModal
          company={selected}
          members={members.filter((m) => m.company_id === selected.id)}
          tickets={tickets}
          onClose={() => setSelected(null)}
          onOpenTickets={() => {
            const name = selected.name;
            setSelected(null);
            onOpen(name);
          }}
        />
      )}
    </>
  );
}

function StatusBadges({
  byStatus,
  total,
}: {
  byStatus: Record<TicketStatus, number>;
  total: number;
}) {
  if (total === 0) {
    return <span className="text-xs text-[#9db3ac]">Заявок нет</span>;
  }
  return (
    <>
      {STATUSES.filter((s) => byStatus[s] > 0).map((s) => {
        const [color, bg] = STATUS_COLORS[s];
        return (
          <span
            key={s}
            style={{ background: bg, color }}
            className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
          >
            {s}: {byStatus[s]}
          </span>
        );
      })}
    </>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-pressed={active}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition"
      style={{
        background: active ? "#eaf6f3" : "transparent",
        color: active ? "#0c7d70" : "#6f887f",
      }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="0" y="0" width="7" height="7" rx="1.5" />
      <rect x="9" y="0" width="7" height="7" rx="1.5" />
      <rect x="0" y="9" width="7" height="7" rx="1.5" />
      <rect x="9" y="9" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="0" y="1" width="16" height="3" rx="1.5" />
      <rect x="0" y="6.5" width="16" height="3" rx="1.5" />
      <rect x="0" y="12" width="16" height="3" rx="1.5" />
    </svg>
  );
}

function plural(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return "заявка";
  if (d >= 2 && d <= 4 && (dd < 10 || dd >= 20)) return "заявки";
  return "заявок";
}
