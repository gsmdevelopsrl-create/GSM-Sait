/**
 * Распознавание текста на изображении (OCR) через мультимодальную модель.
 *
 * В отличие от классических OCR-движков модель понимает, что перед ней
 * скриншот интерфейса, и не мешает текст ошибки с подписями кнопок.
 * Используется тот же ключ OpenAI, что и для распознавания речи.
 */

const PROMPT =
  "На изображении — скриншот из программы 1С или фотография экрана. " +
  "Извлеки весь значимый текст: текст ошибки, сообщения, названия документов " +
  "и полей. Сохрани переносы строк. Если на картинке есть текст ошибки — " +
  "приведи его первым. Отвечай только текстом с изображения, без пояснений " +
  "и без markdown. Если читаемого текста нет, ответь: НЕТ ТЕКСТА";

export function isVisionEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export type OcrResult = { text?: string; error?: string };

/** Принимает временную ссылку на файл — модель скачивает картинку сама. */
export async function extractTextFromImage(imageUrl: string): Promise<OcrResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "Распознавание изображений не настроено." };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[ocr] OpenAI error:", res.status, detail.slice(0, 300));
      return { error: "Не удалось распознать текст на картинке." };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!text || text.toUpperCase().includes("НЕТ ТЕКСТА"))
      return { text: "" }; // картинка без текста — это не ошибка

    return { text };
  } catch (err) {
    console.error("[ocr] request failed:", err);
    return { error: "Сервис распознавания недоступен." };
  }
}
