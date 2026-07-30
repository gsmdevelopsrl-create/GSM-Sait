import { createBrowserClient } from "@supabase/ssr";

/** Клиент Supabase для использования в браузере (клиентские компоненты). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
