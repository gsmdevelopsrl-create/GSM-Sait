export type Role = "client" | "admin";

export type TicketStatus =
  | "Новая"
  | "На утверждении"
  | "Утверждена"
  | "Отклонена"
  | "В работе"
  | "На проверке"
  | "Выполнена";
export type TicketPriority = "Низкий" | "Средний" | "Высокий" | "Срочно";
export type TicketCategory =
  | "Внедрение"
  | "Доработка"
  | "Поддержка"
  | "Обучение"
  | "Интеграция";
export type AttachmentType = "image" | "file" | "link";
/** Откуда пришла заявка */
export type TicketSource = "site" | "telegram";

export interface Profile {
  id: string;
  full_name: string | null;
  position: string | null;
  phone: string | null;
  company_id: string | null;
  role: Role;
  company?: { name: string } | null;
}

export interface Attachment {
  id: string;
  ticket_id: number;
  type: AttachmentType;
  name: string;
  url: string | null;
  storage_path?: string | null;
  size_bytes?: number | null;
  /** Временная ссылка для скачивания, генерируется на сервере */
  signedUrl?: string | null;
}

export interface Comment {
  id: string;
  ticket_id: number;
  author_name: string;
  is_client: boolean;
  body: string;
  created_at: string;
}

export interface Ticket {
  id: number;
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string | null;
  /** Желаемая дата исполнения — указывает клиент */
  deadline: string | null;
  /** Оценка работ в часах — ставит администратор */
  estimate: number | null;
  /** Причина отказа клиента при статусе «Отклонена» */
  rejection_reason: string | null;
  company_id: string | null;
  author_id: string | null;
  assignee: string;
  source: TicketSource | null;
  created_at: string;
  company?: { name: string } | null;
  author?: {
    full_name: string | null;
    telegram_username?: string | null;
  } | null;
  ticket_attachments?: Attachment[];
  ticket_comments?: Comment[];
}
