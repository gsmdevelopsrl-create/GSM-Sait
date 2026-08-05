"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Кнопка голосового ввода: пишет звук с микрофона и возвращает расшифровку.
 *
 * Работает и на сайте, и внутри Telegram Mini App — во втором случае
 * передаётся initData для проверки прав на сервере.
 */
export function VoiceInput({
  onText,
  initData,
  label = "Продиктовать",
  compact,
}: {
  onText: (text: string) => void;
  initData?: string;
  label?: string;
  compact?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Подчищаем таймер и микрофон, если компонент исчез во время записи
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /** Формат, который умеет конкретный браузер (iOS не поддерживает webm). */
  const pickMimeType = (): string | undefined => {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t))
        return t;
    }
    return undefined;
  };

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Микрофон недоступен — введите текст вручную.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Нет доступа к микрофону — разрешите его или введите текст.");
      return;
    }

    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError("Запись не поддерживается в этом браузере.");
      return;
    }

    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = rec.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      await send(blob, type);
    };

    recorderRef.current = rec;
    rec.start();
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    recorderRef.current?.stop();
  };

  const send = async (blob: Blob, type: string) => {
    setBusy(true);
    try {
      const ext = type.includes("mp4")
        ? "m4a"
        : type.includes("ogg")
          ? "ogg"
          : "webm";
      const fd = new FormData();
      fd.append("audio", new File([blob], `voice.${ext}`, { type }));
      if (initData) fd.append("initData", initData);

      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = (await res.json()) as { text?: string; error?: string };

      if (!res.ok || !data.text) {
        setError(data.error ?? "Не удалось распознать речь.");
      } else {
        onText(data.text);
      }
    } catch {
      setError("Не удалось отправить запись.");
    } finally {
      setBusy(false);
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;

  return (
    <div className={compact ? "" : "mt-2"}>
      <button
        type="button"
        disabled={busy}
        onClick={recording ? stop : start}
        title={recording ? "Остановить запись" : label}
        className={`flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-3 py-2 text-[13px] font-bold transition disabled:opacity-60 ${
          compact ? "" : "w-full"
        }`}
        style={
          recording
            ? { borderColor: "#d64545", background: "#fdf2f2", color: "#d64545" }
            : { borderColor: "#b7d5cd", background: "#f4f9f7", color: "#0c7d70" }
        }
      >
        {busy ? (
          "Расшифровываем…"
        ) : recording ? (
          <>■ Стоп · {mmss}</>
        ) : (
          <>🎤 {compact ? "" : label}</>
        )}
      </button>
      {error && (
        <div className="mt-1 text-[11px] font-semibold text-[#d64545]">{error}</div>
      )}
    </div>
  );
}
