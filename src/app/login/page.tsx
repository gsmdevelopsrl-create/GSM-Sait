"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { signIn, signUp, type AuthState } from "./actions";

const initial: AuthState = {};

const inputCls =
  "w-full rounded-xl border-[1.5px] border-[#dde9e5] px-[15px] py-[13px] text-sm text-ink outline-none focus:border-brand";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const action = mode === "in" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-[420px] max-w-full animate-fadeUp rounded-3xl bg-white p-10 shadow-[0_30px_70px_rgba(21,42,36,.14)]">
        <div className="mb-[26px] flex items-center gap-3">
          <Logo />
          <div>
            <div className="text-[17px] font-extrabold">GSM Developer</div>
            <div className="text-[11px] font-semibold tracking-[1.5px] text-muted">
              ЛИЧНЫЙ КАБИНЕТ
            </div>
          </div>
        </div>

        <div className="mb-1.5 text-[23px] font-extrabold">
          {mode === "in" ? "С возвращением 👋" : "Регистрация"}
        </div>
        <p className="mb-6 text-sm text-muted">
          {mode === "in"
            ? "Войдите в кабинет, чтобы вести заявки"
            : "Создайте аккаунт клиента для вашей компании"}
        </p>

        {/* key сбрасывает поля при смене режима */}
        <form key={mode} action={formAction} className="flex flex-col gap-3">
          {mode === "up" && (
            <>
              <input name="full_name" placeholder="Ваше имя" required className={inputCls} />
              <input name="company_name" placeholder="Название компании" required className={inputCls} />
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="Телефон: +373 69 123 456"
                required
                className={inputCls}
              />
            </>
          )}
          <input name="email" type="email" placeholder="Email" required className={inputCls} autoComplete="email" />
          <input name="password" type="password" placeholder="Пароль" required className={inputCls} autoComplete={mode === "in" ? "current-password" : "new-password"} />

          {state.error && (
            <div className="rounded-lg bg-[#fbe3e3] px-3 py-2 text-sm font-semibold text-[#d64545]">
              {state.error}
            </div>
          )}
          {state.info && (
            <div className="rounded-lg bg-[#d9f2e3] px-3 py-2 text-sm font-semibold text-[#1a9d55]">
              {state.info}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 w-full rounded-xl bg-brand py-3.5 text-[15px] font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Подождите…" : mode === "in" ? "Войти" : "Зарегистрироваться"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-4 w-full text-center text-sm font-semibold text-brand hover:text-brand-dark"
        >
          {mode === "in"
            ? "Нет аккаунта? Зарегистрироваться"
            : "Уже есть аккаунт? Войти"}
        </button>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm font-semibold text-muted hover:text-brand">
            ← На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
