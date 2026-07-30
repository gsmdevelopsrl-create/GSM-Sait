"use client";

import { useActionState } from "react";
import { submitLead, type LeadState } from "@/app/actions";

const initial: LeadState = { ok: false };

export function LeadForm() {
  const [state, formAction, pending] = useActionState(submitLead, initial);

  if (state.ok) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-8 text-center">
        <div className="text-4xl">✅</div>
        <div className="text-lg font-extrabold text-ink">Заявка отправлена!</div>
        <p className="text-sm text-muted">Мы свяжемся с вами в течение часа.</p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl bg-white p-6"
    >
      <input
        name="name"
        required
        placeholder="Ваше имя"
        className="rounded-xl border-[1.5px] border-[#dde9e5] px-4 py-3 text-sm text-ink outline-none focus:border-brand"
      />
      <input
        name="contact"
        required
        placeholder="Email или телефон"
        className="rounded-xl border-[1.5px] border-[#dde9e5] px-4 py-3 text-sm text-ink outline-none focus:border-brand"
      />
      <textarea
        name="message"
        rows={4}
        placeholder="Опишите задачу по 1С"
        className="resize-none rounded-xl border-[1.5px] border-[#dde9e5] px-4 py-3 text-sm text-ink outline-none focus:border-brand"
      />
      {state.error && (
        <div className="text-sm font-semibold text-[#d64545]">{state.error}</div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Отправляем…" : "Отправить"}
      </button>
    </form>
  );
}
