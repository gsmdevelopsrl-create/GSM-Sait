"use client";

import { useState } from "react";
import { STATUSES, STATUS_COLORS, initials } from "@/lib/constants";
import { CompanyModal } from "./CompanyModal";
import type { Ticket, TicketStatus } from "@/lib/types";

type Company = { id: string; name: string };
type Member = { id: string; full_name: string | null; role: string; company_id: string | null };

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
              {STATUSES.filter((s) => byStatus[s] > 0).map((s) => {
                const [color, bg] = STATUS_COLORS[s];
                return (
                  <span
                    key={s}
                    style={{ background: bg, color }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  >
                    {s}: {byStatus[s]}
                  </span>
                );
              })}
              {total === 0 && (
                <span className="text-xs text-[#9db3ac]">Заявок нет</span>
              )}
            </div>
          </button>
        ))}
      </div>

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

function plural(n: number): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return "заявка";
  if (d >= 2 && d <= 4 && (dd < 10 || dd >= 20)) return "заявки";
  return "заявок";
}
