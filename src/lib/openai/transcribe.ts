/**
 * Распознавание речи через OpenAI (Whisper).
 *
 * Ключ живёт только на сервере. Если он не задан — функция честно сообщает
 * об этом, а интерфейс прячет кнопку диктовки.
 */

/** Термины 1С — подсказка модели, чтобы она не перевирала предметные слова. */
const DOMAIN_PROMPT =
  "Заявка по 1С. Возможные термины: 1С, ЗУП, Бухгалтерия, УТ, УНФ, " +
  "конфигурация, обработка, печатная форма, регистр накопления, проведение " +
  "документа, РКО, ПКО, накладная, счёт-фактура, номенклатура, контрагент, " +
  "склад, остатки, выгрузка, обмен, Битрикс, ЕГАИС, МойСклад.";

export function isTranscribeEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export type TranscribeResult = { text?: string; error?: string };

export async function transcribeAudio(file: File): Promise<TranscribeResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "Распознавание речи не настроено." };

  if (file.size === 0) return { error: "Пустая запись." };
  if (file.size > 24 * 1024 * 1024)
    return { error: "Запись слишком длинная — до 25 МБ." };

  const form = new FormData();
  form.append("file", file);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  form.append("language", process.env.OPENAI_TRANSCRIBE_LANG || "ru");
  form.append("prompt", DOMAIN_PROMPT);
  form.append("response_format", "text");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[transcribe] OpenAI error:", res.status, detail.slice(0, 300));
      return { error: "Не удалось распознать речь. Попробуйте ещё раз." };
    }

    const text = (await res.text()).trim();
    if (!text) return { error: "Речь не распознана — попробуйте говорить чётче." };
    return { text };
  } catch (err) {
    console.error("[transcribe] request failed:", err);
    return { error: "Сервис распознавания недоступен." };
  }
}
