"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { TicketList } from "./TicketList";
import { NewTicketModal } from "./NewTicketModal";
import { signOut } from "@/app/login/actions";
import type { Ticket, Role, TicketStatus } from "@/lib/types";

type Me = { name: string; company: string; ini: string };

const clientNav = ["Мои заявки", "Профиль", "Документы"];
const adminNav = ["Заявки", "Компании", "Аналитика"];

export function Dashboard({
  role,
  me,
  tickets,
}: {
  role: Role;
  me: Me;
  tickets: Ticket[];
}) {
  const isAdmin = role === "admin";
  const [showNew, setShowNew] = useState(false);
  const nav = isAdmin ? adminNav : clientNav;

  const count = (s: TicketStatus) =>
    tickets.filter((t) => t.status === s).length;

  const stats: { label: string; value: number; color: string }[] = isAdmin
    ? [
        { label: "Всего заявок", value: tickets.length, color: "#152a24" },
        { label: "В работе", value: count("В работе"), color: "#1a9d55" },
        { label: "На проверке", value: count("На проверке"), color: "#c47d17" },
        { label: "Выполнено", value: count("Выполнена"), color: "#6f887f" },
      ]
    : [
        { label: "Мои заявки", value: tickets.length, color: "#152a24" },
        { label: "Новые", value: count("Новая"), color: "#4a7cd6" },
        { label: "В работе", value: count("В работе"), color: "#1a9d55" },
        { label: "Выполнено", value: count("Выполнена"), color: "#6f887f" },
      ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Шапка */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e2ede9] bg-white px-4 py-4 md:px-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <Logo size={38} />
            <div className="leading-tight">
              <div className="text-[15px] font-extrabold">GSM Developer</div>
              <div className="text-[10px] font-semibold tracking-[1.5px] text-muted">
                {isAdmin ? "АДМИНИСТРАТОР" : "КЛИЕНТ"}
              </div>
            </div>
          </div>
          <nav className="hidden gap-1.5 md:flex">
            {nav.map((label, i) => (
              <button
                key={label}
                className="rounded-full px-4 py-2 text-[13px] font-bold"
                style={{
                  background: i === 0 ? "#eaf6f3" : "transparent",
                  color: i === 0 ? "#0c7d70" : "#42574f",
                }}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3.5">
          {!isAdmin && (
            <button
              onClick={() => setShowNew(true)}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              + Новая заявка
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-bold">{me.name}</div>
              <div className="text-[11px] text-muted">{me.company}</div>
            </div>
            <div className="grid h-[38px] w-[38px] place-items-center rounded-full bg-mint text-[13px] font-bold text-brand-dark">
              {me.ini}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border-[1.5px] border-[#dde9e5] px-3 py-2 text-[13px] text-slate transition hover:border-brand hover:text-brand"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Контент */}
      <div className="mx-auto w-full max-w-[960px] px-4 pb-10 pt-8 md:px-8">
        <div className="mb-6">
          <h1 className="text-[26px] font-extrabold tracking-[-.5px]">
            {isAdmin ? "Все заявки" : "Мои заявки"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isAdmin ? "Заявки по всем компаниям" : `Заявки компании ${me.company}`}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-white px-5 py-[18px]">
              <div className="mb-2 text-[13px] font-semibold text-muted">{s.label}</div>
              <div className="text-[30px] font-extrabold" style={{ color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <TicketList tickets={tickets} isAdmin={isAdmin} />
      </div>

      {showNew && <NewTicketModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
