"use client";

import {
  STATUSES,
  STATUS_COLORS,
  CATEGORIES,
  PRIORITIES,
  PRIORITY_COLORS,
} from "@/lib/constants";
import type { Ticket, TicketStatus, TicketPriority } from "@/lib/types";

type Bar = { label: string; value: number; color: string };

export function AnalyticsView({ tickets }: { tickets: Ticket[] }) {
  const total = tickets.length;

  if (!total) {
    return (
      <div className="rounded-2xl bg-white p-12 text-center text-[#9db3ac]">
        Пока нет данных для аналитики — заявок ещё не создавали.
      </div>
    );
  }

  const done = tickets.filter((t) => t.status === "Выполнена").length;
  const open = total - done;
  const estimates = tickets
    .map((t) => t.estimate)
    .filter((e): e is number => typeof e === "number" && e > 0);
  const avgEstimate = estimates.length
    ? Math.round(estimates.reduce((a, b) => a + b, 0) / estimates.length)
    : 0;

  const kpis = [
    { label: "Всего заявок", value: String(total), color: "#152a24" },
    { label: "Открытых", value: String(open), color: "#1a9d55" },
    { label: "Выполнено", value: String(done), color: "#6f887f" },
    { label: "Средняя оценка", value: `${avgEstimate} ч`, color: "#0f9d8c" },
  ];

  const byStatus: Bar[] = STATUSES.map((s: TicketStatus) => ({
    label: s,
    value: tickets.filter((t) => t.status === s).length,
    color: STATUS_COLORS[s][0],
  }));

  const byCategory: Bar[] = CATEGORIES.map((c) => ({
    label: c,
    value: tickets.filter((t) => t.category === c).length,
    color: "#0f9d8c",
  })).filter((b) => b.value > 0);

  const byPriority: Bar[] = PRIORITIES.map((p: TicketPriority) => ({
    label: p,
    value: tickets.filter((t) => t.priority === p).length,
    color: PRIORITY_COLORS[p][0],
  })).filter((b) => b.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-line bg-white px-5 py-[18px]"
          >
            <div className="mb-2 text-[13px] font-semibold text-muted">
              {k.label}
            </div>
            <div
              className="text-[30px] font-extrabold"
              style={{ color: k.color }}
            >
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCard title="По статусам" bars={byStatus} total={total} />
        <ChartCard title="По приоритету" bars={byPriority} total={total} />
      </div>
      <ChartCard title="По категориям" bars={byCategory} total={total} />
    </div>
  );
}

function ChartCard({
  title,
  bars,
  total,
}: {
  title: string;
  bars: Bar[];
  total: number;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 text-sm font-extrabold">{title}</div>
      <div className="flex flex-col gap-3">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-[13px] text-slate">{b.label}</div>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(b.value / max) * 100}%`,
                  background: b.color,
                  minWidth: b.value > 0 ? 6 : 0,
                }}
              />
            </div>
            <div className="w-16 shrink-0 text-right text-[13px] font-bold">
              {b.value}
              <span className="ml-1 font-normal text-muted">
                {total ? Math.round((b.value / total) * 100) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
