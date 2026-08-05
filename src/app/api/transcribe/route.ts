import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyInitData } from "@/lib/telegram/verify";
import { transcribeAudio, isTranscribeEnabled } from "@/lib/openai/transcribe";

/**
 * Распознавание речи для сайта и Telegram Mini App.
 *
 * Доступ: либо активная сессия Supabase (сайт), либо подписанные данные
 * Telegram (Mini App). Посторонние запросы отклоняются — иначе эндпоинт
 * стал бы бесплатным распознаванием речи за наш счёт.
 */
export async function POST(request: Request) {
  if (!isTranscribeEnabled()) {
    return NextResponse.json(
      { error: "Распознавание речи не настроено." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Неверный запрос." }, { status: 400 });
  }

  const initData = form.get("initData");
  let allowed = false;

  if (typeof initData === "string" && initData) {
    allowed = !!verifyInitData(initData);
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    allowed = !!user;
  }

  if (!allowed) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Файл не передан." }, { status: 400 });
  }

  const result = await transcribeAudio(audio);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ text: result.text });
}
