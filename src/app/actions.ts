"use server";

import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";

export type LeadState = { ok: boolean; error?: string };

/** Приём заявки с публичной формы лендинга. */
export async function submitLead(
  _prev: LeadState,
  formData: FormData
): Promise<LeadState> {
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !contact) {
    return { ok: false, error: "Укажите имя и контакт." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .insert({ name, contact, message });

  if (error) {
    return { ok: false, error: "Не удалось отправить. Попробуйте позже." };
  }

  await notify({ type: "lead.created", name, contact, message });
  return { ok: true };
}
