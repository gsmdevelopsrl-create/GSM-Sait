/**
 * Молдавские номера телефонов.
 *
 * Хранимый формат — нормализованный: +373XXXXXXXX
 * (код страны 373 + 8 цифр, первая из них 2–9).
 *
 * Принимаем от пользователя любой привычный ввод:
 *   +373 69 123 456 · 0037369123456 · 069123456 · 69 12 34 56
 */

const MD_RE = /^\+373[2-9]\d{7}$/;

/** Приводит ввод к виду +373XXXXXXXX. Возвращает null, если номер некорректный. */
export function normalizeMdPhone(input: string): string | null {
  let d = (input || "").replace(/\D/g, "");

  if (d.startsWith("00373")) d = d.slice(5);
  else if (d.startsWith("373")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1); // местная запись 0XX XXX XXX

  if (!/^[2-9]\d{7}$/.test(d)) return null;
  return `+373${d}`;
}

/** Проверяет уже нормализованный номер. */
export function isValidMdPhone(phone: string | null | undefined): boolean {
  return !!phone && MD_RE.test(phone);
}

/** Красивый вид для интерфейса: +373 69 123 456 */
export function formatMdPhone(phone: string | null | undefined): string {
  if (!isValidMdPhone(phone)) return phone || "—";
  const d = phone!.slice(4); // 8 цифр
  return `+373 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
}

export const MD_PHONE_HINT = "Формат: +373 69 123 456";
