"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeMdPhone, MD_PHONE_HINT } from "@/lib/phone";

export type AuthState = { error?: string; info?: string };

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Введите email и пароль." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Неверный email или пароль." };
  }

  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const phoneRaw = String(formData.get("phone") ?? "").trim();

  if (!fullName || !companyName || !email || !password || !phoneRaw) {
    return { error: "Заполните все поля." };
  }
  if (password.length < 6) {
    return { error: "Пароль должен быть не короче 6 символов." };
  }

  const phone = normalizeMdPhone(phoneRaw);
  if (!phone) {
    return { error: `Неверный номер телефона. ${MD_PHONE_HINT}` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName, phone },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/dashboard`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Если в проекте включено подтверждение email — сессии ещё нет.
  if (!data.session) {
    return {
      info: "Аккаунт создан. Подтвердите email по ссылке из письма, затем войдите.",
    };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
