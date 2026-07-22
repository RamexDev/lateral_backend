// Import environment variables.
import { env } from '../config/env.js';

// Import logger.
import { logger } from './logger.js';

// Send a Telegram bot message.
// In development/test or when using a dev token, this is a safe no-op.
export async function sendTelegramMessage(chatId, text) {
  // Read bot token.
  const token = env.TELEGRAM_BOT_TOKEN;

  // Skip sending when no real Telegram token is configured.
  if (!token || token.startsWith('dev-') || env.NODE_ENV !== 'production') {
    logger.info({ chatId }, 'Telegram message send skipped');
    return { skipped: true };
  }

  // Build Telegram sendMessage URL.
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';

  // Call Telegram Bot API.
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });

  // Log and throw when Telegram rejects the request.
  if (!response.ok) {
    const payload = await response.text();
    logger.error({ status: response.status, payload }, 'Telegram send failed');
    throw new Error('Telegram send failed');
  }

  // Return Telegram response payload.
  return response.json();
}
