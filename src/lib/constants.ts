import type {
  TicketStatus,
  TicketPriority,
  TicketCategory,
  AttachmentType,
  TicketSource,
} from "./types";

/** Статусы в порядке жизненного цикла заявки */
export const STATUSES: TicketStatus[] = [
  "Новая",
  "На утверждении",
  "Утверждена",
  "Отклонена",
  "В работе",
  "На проверке",
  "Выполнена",
];

export const PRIORITIES: TicketPriority[] = [
  "Низкий",
  "Средний",
  "Высокий",
  "Срочно",
];

export const CATEGORIES: TicketCategory[] = [
  "Внедрение",
  "Доработка",
  "Поддержка",
  "Обучение",
  "Интеграция",
];

export const TEAM = [
  "—",
  "Артём Иванов",
  "Дмитрий Соколов",
  "Елена Крылова",
];

// Цвета бейджей: [цвет текста, цвет фона] — из дизайна «Вариант D»
export const STATUS_COLORS: Record<TicketStatus, [string, string]> = {
  Новая: ["#4a7cd6", "#e5edfb"],
  "На утверждении": ["#c47d17", "#fbeed4"],
  Утверждена: ["#0c7d70", "#d6f0eb"],
  Отклонена: ["#d64545", "#fbe3e3"],
  "В работе": ["#1a9d55", "#d9f2e3"],
  "На проверке": ["#c47d17", "#fbeed4"],
  Выполнена: ["#6f887f", "#e7eeeb"],
};

export const PRIORITY_COLORS: Record<TicketPriority, [string, string]> = {
  Срочно: ["#d64545", "#fbe3e3"],
  Высокий: ["#d67d17", "#fbeed4"],
  Средний: ["#4a5f57", "#e7eeeb"],
  Низкий: ["#6f887f", "#eef3f1"],
};

export function attachmentIcon(type: AttachmentType): string {
  return type === "image" ? "🖼" : type === "link" ? "🔗" : "📎";
}

/** Подпись и цвета бейджа «Источник» */
export const SOURCE_LABEL: Record<TicketSource, { text: string; bg: string; fg: string }> = {
  site: { text: "🌐 Сайт", bg: "#eef3f1", fg: "#4a5f57" },
  telegram: { text: "✈️ Telegram", bg: "#e5edfb", fg: "#4a7cd6" },
};

export function sourceBadge(source: TicketSource | null | undefined) {
  return source ? SOURCE_LABEL[source] ?? null : null;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "GS";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}
