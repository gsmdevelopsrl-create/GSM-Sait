export type Role = "client" | "admin";

export type TicketStatus = "Новая" | "В работе" | "На проверке" | "Выполнена";
export type TicketPriority = "Низкий" | "Средний" | "Высокий" | "Срочно";
export type TicketCategory =
  | "Внедрение"
  | "Доработка"
  | "Поддержка"
  | "Обучение"
  | "Интеграция";
export type AttachmentType = "image" | "file" | "link";

export interface Profile {
  id: string;
  full_name: string | null;
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
  deadline: string | null;
  estimate: number | null;
  company_id: string | null;
  author_id: string | null;
  assignee: string;
  created_at: string;
  company?: { name: string } | null;
  author?: { full_name: string | null } | null;
  ticket_attachments?: Attachment[];
  ticket_comments?: Comment[];
}
