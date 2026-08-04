"use client";

import { useState, useTransition } from "react";
import { STATUSES, STATUS_COLORS, initials } from "@/lib/constants";
import { updateCompany } from "@/app/dashboard/actions";
import type { Ticket, TicketStatus } from "@/lib/types";

type Member = { id: string; full_name: string | null; role: string };

export function CompanyModal({
  company,
  members,
  tickets,
  onClose,
  onOpenTickets,
}: {
  company: { id: string; name: string };
  members: Member[];
  tickets: Ticket[];
  onClose: () => void;
  onOpenTickets: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [memberNames, setMemberNames] = useState<Record<string, string>>(
    Object.fromEntries(members.map((m) => [m.id, m.full_name ?? ""]))
  );
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const own = tickets.filter((t) => t.company?.name === company.name);
  const byStatus = STATUSES.map((s: TicketStatus) => ({
    s,
    n: own.filter((t) => t.status === s).length,
  })).filter((x) => x.n > 0);

  const inputCls =
    "w-full rounded-xl border-[1.5px] border-[#dde9e5] px-[15px] py-2.5 text-sm text-ink outline-none focus:border-brand";

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updateCompany({
        companyId: company.id,
        name,
        members: members.map((m) => ({
          id: m.id,
          full_name: memberNames[m.id] ?? "",
        })),
      });
      if (res.error) setMsg({ ok: false, text: res.error });
      else setMsg({ ok: true, text: "Сохранено." });
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(21,42,36,.5)] p-6"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        className="max-h-[92vh] w-[560px] max-w-full animate-fadeUp overflow-auto rounded-[20px] bg-white shadow-[0_40px_90px_rgba(0,0,0,.3)]"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-canvas bg-white px-7 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-sm font-bold text-brand-dark">
              {initials(company.name.replace(/[«»"]/g, ""))}
            </div>
            <h2 className="text-lg font-extrabold">Карточка клиента</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-canvas text-lg text-slate"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 px-7 py-6">
          <div>
            <label className="mb-1.5 block text-[13px] font-bold">
              Название компании
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <div className="mb-2 text-[13px] font-bold">Заявки</div>
            {own.length === 0 ? (
              <div className="text-sm text-muted">Заявок нет</div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold">Всего: {own.length}</span>
                {byStatus.map(({ s, n }) => {
                  const [color, bg] = STATUS_COLORS[s];
                  return (
                    <span
                      key={s}
                      style={{ background: bg, color }}
                      className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                    >
                      {s}: {n}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-[13px] font-bold">
              Сотрудники ({members.length})
            </div>
            {members.length === 0 ? (
              <div className="text-sm text-muted">
                Нет зарегистрированных сотрудников.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center gap-2.5">
                    <input
                      value={memberNames[m.id] ?? ""}
                      onChange={(e) =>
                        setMemberNames((prev) => ({
                          ...prev,
                          [m.id]: e.target.value,
                        }))
                      }
                      placeholder="Имя сотрудника"
                      className={inputCls}
                    />
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={
                        m.role === "admin"
                          ? { background: "#d6f0eb", color: "#0c7d70" }
                          : { background: "#eef3f1", color: "#6f887f" }
                      }
                    >
                      {m.role === "admin" ? "Админ" : "Клиент"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {msg && (
            <div
              className="rounded-lg px-3 py-2 text-sm font-semibold"
              style={
                msg.ok
                  ? { background: "#d9f2e3", color: "#1a9d55" }
                  : { background: "#fbe3e3", color: "#d64545" }
              }
            >
              {msg.text}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-between gap-3 border-t border-canvas bg-white px-7 py-4">
          <button
            type="button"
            onClick={onOpenTickets}
            className="rounded-xl border-[1.5px] border-[#dde9e5] bg-white px-4 py-2.5 text-sm font-bold text-slate hover:border-brand hover:text-brand"
          >
            Показать заявки
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {pending ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
