"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { TicketList } from "./TicketList";
import { NewTicketModal } from "./NewTicketModal";
import { CompaniesView } from "./CompaniesView";
import { AnalyticsView } from "./AnalyticsView";
import { ProfileView } from "./ProfileView";
import { signOut } from "@/app/login/actions";
import type { Ticket, Role, TicketStatus } from "@/lib/types";

type Me = {
  name: string;
  company: string;
  realCompany: string;
  ini: string;
  email: string;
};
type Company = { id: string; name: string };
type Section = "tickets" | "companies" | "analytics" | "profile" | "documents";

const clientNav: { key: Section; label: string }[] = [
  { key: "tickets", label: "Мои заявки" },
  { key: "profile", label: "Профиль" },
  { key: "documents", label: "Документы" },
];
const adminNav: { key: Section; label: string }[] = [
  { key: "tickets", label: "Заявки" },
  { key: "companies", label: "Компании" },
  { key: "analytics", label: "Аналитика" },
];

export function Dashboard({
  role,
  me,
  tickets,
  companies,
}: {
  role: Role;
  me: Me;
  tickets: Ticket[];
  companies: Company[];
}) {
  const isAdmin = role === "admin";
  const [showNew, setShowNew] = useState(false);
  const [section, setSection] = useState<Section>("tickets");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const nav = isAdmin ? adminNav : clientNav;

  const openCompany = (name: string) => {
    setCompanyFilter(name);
    setSection("tickets");
  };
  const go = (s: Section) => {
    setCompanyFilter(null);
    setSection(s);
  };

  const displayed =
    companyFilter && isAdmin
      ? tickets.filter((t) => t.company?.name === companyFilter)
      : tickets;

  const count = (s: TicketStatus) =>
    displayed.filter((t) => t.status === s).length;

  const stats: { label: string; value: number; color: string }[] = isAdmin
    ? [
        { label: "Всего заявок", value: displayed.length, color: "#152a24" },
        { label: "В работе", value: count("В работе"), color: "#1a9d55" },
        { label: "На проверке", value: count("На проверке"), color: "#c47d17" },
        { label: "Выполнено", value: count("Выполнена"), color: "#6f887f" },
      ]
    : [
        { label: "Мои заявки", value: displayed.length, color: "#152a24" },
        { label: "Новые", value: count("Новая"), color: "#4a7cd6" },
        { label: "В работе", value: count("В работе"), color: "#1a9d55" },
        { label: "Выполнено", value: count("Выполнена"), color: "#6f887f" },
      ];

  const titles: Record<Section, { title: string; sub: string }> = {
    tickets: {
      title: isAdmin ? "Все заявки" : "Мои заявки",
      sub: isAdmin
        ? companyFilter
          ? `Компания: ${companyFilter}`
          : "Заявки по всем компаниям"
        : `Заявки компании ${me.company}`,
    },
    companies: { title: "Компании", sub: "Клиенты и их заявки" },
    analytics: { title: "Аналитика", sub: "Сводка по всем заявкам" },
    profile: { title: "Профиль", sub: "Данные вашей учётной записи" },
    documents: { title: "Документы", sub: "Файлы и договоры" },
  };
  const head = titles[section];

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
            {nav.map((item) => {
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => go(item.key)}
                  className="rounded-full px-4 py-2 text-[13px] font-bold transition"
                  style={{
                    background: active ? "#eaf6f3" : "transparent",
                    color: active ? "#0c7d70" : "#42574f",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
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

      {/* Мобильная навигация */}
      <nav className="flex gap-1.5 overflow-x-auto border-b border-[#e2ede9] bg-white px-4 py-2 md:hidden">
        {nav.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              onClick={() => go(item.key)}
              className="whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold"
              style={{
                background: active ? "#eaf6f3" : "transparent",
                color: active ? "#0c7d70" : "#42574f",
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Контент */}
      <div className="mx-auto w-full max-w-[960px] px-4 pb-10 pt-8 md:px-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-.5px]">
              {head.title}
            </h1>
            <p className="mt-1 text-sm text-muted">{head.sub}</p>
          </div>
          {section === "tickets" && companyFilter && (
            <button
              onClick={() => go("companies")}
              className="rounded-full border-[1.5px] border-[#dde9e5] px-3 py-1.5 text-[13px] font-semibold text-slate hover:border-brand hover:text-brand"
            >
              ← Все компании
            </button>
          )}
        </div>

        {section === "tickets" && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3.5 md:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-line bg-white px-5 py-[18px]"
                >
                  <div className="mb-2 text-[13px] font-semibold text-muted">
                    {s.label}
                  </div>
                  <div
                    className="text-[30px] font-extrabold"
                    style={{ color: s.color }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
            <TicketList tickets={displayed} isAdmin={isAdmin} />
          </>
        )}

        {section === "companies" && (
          <CompaniesView
            companies={companies}
            tickets={tickets}
            onOpen={openCompany}
          />
        )}

        {section === "analytics" && <AnalyticsView tickets={tickets} />}

        {section === "profile" && (
          <ProfileView
            name={me.name}
            company={me.realCompany}
            email={me.email}
            ini={me.ini}
            isAdmin={isAdmin}
          />
        )}

        {section === "documents" && (
          <div className="rounded-2xl border border-line bg-white p-12 text-center text-[#9db3ac]">
            Раздел «Документы» скоро появится.
            <br />
            Здесь будут договоры, счета и акты по вашим проектам.
          </div>
        )}
      </div>

      {showNew && <NewTicketModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
