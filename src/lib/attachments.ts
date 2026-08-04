export const BUCKET = "ticket-files";
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 МБ

/** Тип вложения по MIME-типу файла. */
export function attachmentTypeOf(mime: string): "image" | "file" {
  return mime.startsWith("image/") ? "image" : "file";
}

/**
 * Путь в бакете: {ticket_id}/{случайный префикс}-{безопасное имя}
 * Первая папка — id заявки: по ней проверяются права доступа в политиках Storage.
 */
export function buildStoragePath(ticketId: number, fileName: string): string {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-80);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${ticketId}/${Date.now().toString(36)}-${rand}-${safe || "file"}`;
}

export function humanSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}
