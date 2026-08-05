"use client";

import { useState, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  attachmentIcon,
} from "@/lib/constants";
import {
  BUCKET,
  MAX_FILE_BYTES,
  attachmentTypeOf,
  buildStoragePath,
  humanSize,
} from "@/lib/attachments";
import {
  getAttachmentUrl,
  registerAttachment,
  deleteAttachment,
} from "@/app/dashboard/actions";
import type { Attachment } from "@/lib/types";

const chipCls =
  "flex items-center gap-1.5 rounded-[9px] border border-[#dde9e5] bg-[#f4f9f7] px-3 py-2 text-[13px] font-semibold transition hover:border-brand";

export function AttachmentChips({
  items,
  canDelete,
  onDeleted,
}: {
  items: Attachment[];
  canDelete?: boolean;
  onDeleted?: () => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((a) => (
        <div key={a.id} className="flex items-stretch">
          <Chip a={a} />
          {canDelete && <DeleteButton a={a} onDeleted={onDeleted} />}
        </div>
      ))}
    </div>
  );
}

function DeleteButton({
  a,
  onDeleted,
}: {
  a: Attachment;
  onDeleted?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      title="Удалить вложение"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Удалить «${a.name}»?`)) return;
        startTransition(async () => {
          const res = await deleteAttachment(a.id);
          if (res.error) alert(res.error);
          else onDeleted?.();
        });
      }}
      className="ml-1 rounded-[9px] border border-[#dde9e5] bg-white px-2 text-[13px] font-bold text-[#9db3ac] transition hover:border-[#d64545] hover:text-[#d64545] disabled:opacity-50"
    >
      ✕
    </button>
  );
}

function Chip({ a }: { a: Attachment }) {
  const [busy, setBusy] = useState(false);

  const label = (
    <>
      {attachmentIcon(a.type)} {a.name}
      {a.size_bytes ? (
        <span className="font-normal text-muted">{humanSize(a.size_bytes)}</span>
      ) : null}
    </>
  );

  // Внешняя ссылка
  if (a.type === "link" && a.url) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className={chipCls}>
        {label}
      </a>
    );
  }

  // Файл в хранилище — получаем временную ссылку по клику
  if (a.storage_path) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await getAttachmentUrl(a.storage_path!);
          setBusy(false);
          if (res.url) window.open(res.url, "_blank", "noopener");
          else alert(res.error ?? "Файл недоступен");
        }}
        className={`${chipCls} disabled:opacity-60`}
      >
        {busy ? "Открываем…" : label}
      </button>
    );
  }

  // Старые записи без файла (только имя)
  return (
    <span className={`${chipCls} opacity-60`} title="Файл не был загружен">
      {label}
    </span>
  );
}

/** Кнопка добавления файлов к существующей заявке. */
export function AddAttachment({
  ticketId,
  onDone,
}: {
  ticketId: number;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handle = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          setError(`«${file.name}» больше 20 МБ`);
          continue;
        }
        const path = buildStoragePath(ticketId, file.name);
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { upsert: false });
        if (upErr) {
          setError(`Не удалось загрузить «${file.name}»`);
          continue;
        }
        await registerAttachment({
          ticketId,
          type: attachmentTypeOf(file.type),
          name: file.name,
          storagePath: path,
          size: file.size,
        });
      }
      if (inputRef.current) inputRef.current.value = "";
      onDone();
    });
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="rounded-[10px] border-[1.5px] border-dashed border-[#b7d5cd] bg-[#f4f9f7] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
      >
        {pending ? "Загружаем…" : "📎 Прикрепить файл"}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => handle(e.target.files)}
      />
      {error && (
        <div className="mt-2 text-[12px] font-semibold text-[#d64545]">{error}</div>
      )}
    </div>
  );
}
