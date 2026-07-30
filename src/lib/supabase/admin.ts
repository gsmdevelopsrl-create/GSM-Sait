import { createClient } from "@supabase/supabase-js";

/**
 * Клиент с service_role — ТОЛЬКО на сервере. Обходит RLS.
 * Используется для фоновых операций (например, отправки уведомлений).
 * Возвращает null, если ключ не задан.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
