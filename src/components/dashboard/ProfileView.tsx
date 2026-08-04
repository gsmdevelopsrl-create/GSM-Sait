"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/app/dashboard/actions";

export function ProfileView({
  name,
  company,
  position,
  email,
  ini,
  isAdmin,
}: {
  name: string;
  company: string;
  position: string;
  email: string;
  ini: string;
  isAdmin: boolean;
}) {
  const [fullName, setFullName] = useState(name);
  const [companyName, setCompanyName] = useState(company);
  const [jobTitle, setJobTitle] = useState(position);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    fullName.trim() !== name ||
    companyName.trim() !== company ||
    jobTitle.trim() !== position;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updateProfile({
        full_name: fullName,
        company: companyName,
        position: jobTitle,
      });
      if (res.error) setMsg({ ok: false, text: res.error });
      else setMsg({ ok: true, text: "Данные сохранены." });
    });
  };

  const inputCls =
    "w-full rounded-xl border-[1.5px] border-[#dde9e5] px-[15px] py-3 text-sm text-ink outline-none focus:border-brand";

  return (
    <form
      onSubmit={save}
      className="max-w-[520px] rounded-2xl border border-line bg-white p-6"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-mint text-base font-bold text-brand-dark">
          {ini}
        </div>
        <div>
          <div className="text-lg font-extrabold">{fullName || "—"}</div>
          <div className="text-sm text-muted">
            {isAdmin ? "Администратор" : "Клиент"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-bold">Имя</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ваше имя"
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-bold">Компания</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Название компании"
            className={inputCls}
          />
          <p className="mt-1.5 text-[11px] text-muted">
            Если укажете новое название — компания будет создана автоматически.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-bold">Должность</label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="напр. Главный бухгалтер"
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-bold">Email</label>
          <input
            value={email}
            disabled
            className={`${inputCls} cursor-not-allowed bg-[#f4f9f7] text-muted`}
          />
          <p className="mt-1.5 text-[11px] text-muted">
            Email и пароль меняются через поддержку и здесь не редактируются.
          </p>
        </div>

        {msg && (
          <div
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={
              msg.ok
                ? { background: "#d9f2e3", color: "#1a9d55" }
                : { background: "#fbe3e3", color: "#d64545" }
            }
          >
            {msg.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending || !dirty}
            className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {pending ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </div>
    </form>
  );
}
