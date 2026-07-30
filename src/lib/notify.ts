/**
 * Уведомления в Telegram-бота (randan.com).
 *
 * Отправляет сообщение через Telegram Bot API (sendMessage).
 * Нужны переменные окружения TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.
 * Если они не заданы — функция тихо ничего не делает, поэтому сайт
 * работает и без настроенного бота. Ошибки логируются, но НЕ прерывают
 * основную операцию (создание заявки / смену статуса).
 */

type NotifyEvent =
  | {
      type: "ticket.created";
      ticketId: number;
      title: string;
      company: string;
      author: string;
      priority: string;
      category: string;
    }
  | {
      type: "ticket.status_changed";
      ticketId: number;
      title: string;
      company: string;
      status: string;
    }
  | {
      type: "lead.created";
      name: string;
      contact: string;
      message: string;
    };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMessage(e: NotifyEvent): string {
  switch (e.type) {
    case "ticket.created":
      return (
        `🆕 <b>Новая заявка #${e.ticketId}</b>\n` +
        `${escapeHtml(e.title)}\n\n` +
        `🏢 ${escapeHtml(e.company)}\n` +
        `👤 ${escapeHtml(e.author)}\n` +
        `🏷 ${escapeHtml(e.category)} · приоритет: ${escapeHtml(e.priority)}`
      );
    case "ticket.status_changed":
      return (
        `🔄 <b>Заявка #${e.ticketId}</b> — статус: <b>${escapeHtml(e.status)}</b>\n` +
        `${escapeHtml(e.title)}\n` +
        `🏢 ${escapeHtml(e.company)}`
      );
    case "lead.created":
      return (
        `✉️ <b>Заявка с сайта</b>\n` +
        `👤 ${escapeHtml(e.name)}\n` +
        `📞 ${escapeHtml(e.contact)}\n\n` +
        `${escapeHtml(e.message || "—")}`
      );
  }
}

export async function notify(event: NotifyEvent): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatMessage(event),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.error("[notify] telegram failed:", err);
  }
}
