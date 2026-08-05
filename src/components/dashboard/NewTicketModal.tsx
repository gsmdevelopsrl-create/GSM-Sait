"use client";

import { useRef, useState, useTransition } from "react";
import { CATEGORIES, PRIORITIES, attachmentIcon } from "@/lib/constants";
import { createTicket, registerAttachment } from "@/app/dashboard/actions";
import { createClient } from "@/lib/supabase/client";
import {
  BUCKET,
  MAX_FILE_BYTES,
  attachmentTypeOf,
  buildStoragePath,
} from "@/lib/attachments";
import { VoiceInput } from "@/components/VoiceInput";
import type { AttachmentType } from "@/lib/types";

type Draft = {
  type: AttachmentType;
  name: string;
  url?: string;
  file?: File;
};

const inputCls =
  "w-full rounded-[11px] border-[1.5px] border-[#dde9e5] px-3.5 py-3 text-sm outline-none focus:border-brand";
const labelCls = "mb-1.5 block text-[13px] font-bold";

export function NewTicketModal({
  onClose,
  voiceEnabled,
}: {
  onClose: () => void;
  voiceEnabled?: boolean;
}) {
  const [draft, setDraft] = useState<Draft[]>([]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useRef<HTMLFormElement>(null);

  const addFile = (type: AttachmentType, list: FileList | null) => {
    if (!list?.length) return;
    const next: Draft[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`«${file.name}» больше 20 МБ`);
        continue;
      }
      next.push({ type: attachmentTypeOf(file.type) || type, name: file.name, file });
    }
    setDraft((d) => [...d, ...next]);
  };

  const addLink = () => {
    const url = window.prompt("Вставьте ссылку (URL):");
    if (!url) return;
    setDraft((d) => [...d, { type: "link", name: url, url }]);
  };

  const removeAt = (i: number) =>
    setDraft((d) => d.filter((_, idx) => idx !== i));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      // Ссылки уходят вместе с заявкой, файлы загружаем следом
      const res = await createTicket({
        title: String(fd.get("title") ?? ""),
        category: String(fd.get("category") ?? "Доработка"),
        priority: String(fd.get("priority") ?? "Средний"),
        deadline: String(fd.get("deadline") ?? ""),
        estimate: "", // часы ставит администратор при согласовании
        description: String(fd.get("description") ?? ""),
        attachments: draft
          .filter((a) => !a.file)
          .map((a) => ({ type: a.type, name: a.name, url: a.url })),
      });

      if (res.error || !res.ticketId) {
        setError(res.error ?? "Не удалось создать заявку.");
        return;
      }

      const files = draft.filter((a) => a.file);
      if (files.length) {
        const supabase = createClient();
        for (const a of files) {
          const path = buildStoragePath(res.ticketId, a.name);
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, a.file!, { upsert: false });
          if (upErr) continue;
          await registerAttachment({
            ticketId: res.ticketId,
            type: a.type,
            name: a.name,
            storagePath: path,
            size: a.file!.size,
          });
        }
      }
      onClose();
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(21,42,36,.5)] p-6"
    >
      <form
        ref={form}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[92vh] w-[600px] max-w-full animate-fadeUp overflow-auto rounded-[20px] bg-white shadow-[0_40px_90px_rgba(0,0,0,.3)]"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-canvas bg-white px-7 py-6">
          <h2 className="text-xl font-extrabold">Новая заявка на доработку</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-[34px] w-[34px] place-items-center rounded-[9px] bg-canvas text-lg text-slate"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4 px-7 py-6">
          <div>
            <label className={labelCls}>Заголовок *</label>
            <input name="title" required placeholder="Кратко о задаче" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Категория</label>
              <select name="category" className={inputCls} defaultValue="Доработка">
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Приоритет</label>
              <select name="priority" className={inputCls} defaultValue="Средний">
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Желаемая дата исполнения</label>
            <input name="deadline" type="date" className={inputCls} />
            <p className="mt-1.5 text-[11px] text-muted">
              Оценку работ в часах проставит администратор — после этого заявка
              придёт вам на утверждение.
            </p>
          </div>

          <div>
            <label className={labelCls}>Описание задачи</label>
            <textarea
              name="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Опишите, что нужно доработать"
              className={`${inputCls} resize-none`}
            />
            {voiceEnabled && (
              <VoiceInput
                onText={(text) =>
                  setDescription((d) => (d ? `${d} ${text}` : text))
                }
              />
            )}
          </div>

          <div>
            <label className={labelCls}>Вложения</label>
            <div className="mb-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => imgRef.current?.click()}
                className="rounded-[10px] border-[1.5px] border-dashed border-[#b7d5cd] bg-[#f4f9f7] px-4 py-2.5 text-[13px] font-semibold"
              >
                🖼 Картинка
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-[10px] border-[1.5px] border-dashed border-[#b7d5cd] bg-[#f4f9f7] px-4 py-2.5 text-[13px] font-semibold"
              >
                📎 Файл
              </button>
              <button
                type="button"
                onClick={addLink}
                className="rounded-[10px] border-[1.5px] border-dashed border-[#b7d5cd] bg-[#f4f9f7] px-4 py-2.5 text-[13px] font-semibold"
              >
                🔗 Ссылка
              </button>
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => addFile("image", e.target.files)}
              />
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={(e) => addFile("file", e.target.files)}
              />
            </div>
            {draft.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {draft.map((a, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => removeAt(i)}
                    title="Убрать"
                    className="flex items-center gap-1.5 rounded-lg bg-mint px-3 py-1.5 text-[13px] font-semibold text-brand-dark"
                  >
                    {attachmentIcon(a.type)} {a.name} <span className="opacity-60">✕</span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-muted">
              Ссылки сохраняются полностью. Для файлов и картинок сохраняется имя —
              загрузку самих файлов можно подключить через Supabase Storage.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-[#fbe3e3] px-3 py-2 text-sm font-semibold text-[#d64545]">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-canvas bg-white px-7 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[11px] border-[1.5px] border-[#dde9e5] bg-white px-[22px] py-3 text-sm font-bold"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-[11px] bg-brand px-[26px] py-3 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Создаём…" : "Создать заявку"}
          </button>
        </div>
      </form>
    </div>
  );
}
