import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const START_MESSAGE = 'Чтобы запустить игру, нажми <b>«Играть»</b> слева снизу.\nОна работает только внутри Telegram Mini App.';

type TelegramMessage = {
  message_id?: number;
  chat?: {
    id?: number;
  };
  text?: string;
};

type TelegramUpdate = {
  message?: TelegramMessage;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function isStartCommand(message: TelegramMessage) {
  const text = String(message.text || '').trim();
  return text === '/start' || text.startsWith('/start ') || text.startsWith('/start@');
}

async function sendTelegramMessage(botToken: string, chatId: number, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`telegram_send_failed:${response.status}:${errorBody}`);
  }
}

serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('telegram_bot_token_missing');

    const webhookSecret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
    const requestSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
    if (webhookSecret && requestSecret !== webhookSecret) {
      return jsonResponse({ ok: false, error: 'forbidden' }, 403);
    }

    const update = (await request.json()) as TelegramUpdate;
    const message = update.message;
    const chatId = message?.chat?.id;

    if (message && chatId && isStartCommand(message)) {
      await sendTelegramMessage(botToken, chatId, START_MESSAGE);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'telegram_webhook_failed';
    console.error(message);
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
