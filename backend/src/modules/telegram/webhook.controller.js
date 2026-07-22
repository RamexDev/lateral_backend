// Import onboarding service.
import * as onboardingService from '../onboarding/onboarding.service.js';

// Import Telegram helper.
import { sendTelegramMessage } from '../../lib/telegram.js';

// Import logger.
import { logger } from '../../lib/logger.js';

// Handle Telegram bot webhook updates.
export async function handleUpdate(req, res) {
  // Read Telegram update payload.
  const update = req.body || {};

  // Read message object.
  const message = update.message;

  // Handle /start command.
  if (message && message.text === '/start' && message.from && message.from.id) {
    try {
      // Start or resume onboarding for this Telegram user.
      const result = await onboardingService.start({
        telegram_id: message.from.id,
        telegram_username: message.from.username
      });

      // Choose a simple welcome message.
      const text =
        result.step === 'already_registered'
          ? 'Welcome back. Open the Mini App to continue.'
          : 'Welcome to Zwuwur. Please continue onboarding.';

      // Send Telegram message without blocking webhook response.
      sendTelegramMessage(message.from.id, text).catch((err) => {
        logger.error({ err }, 'Failed to send Telegram welcome message');
      });
    } catch (err) {
      // Log but still return 200 to Telegram.
      logger.error({ err }, 'Telegram webhook onboarding start failed');
    }
  }

  // Always acknowledge Telegram quickly.
  res.status(200).json({ ok: true });
}
