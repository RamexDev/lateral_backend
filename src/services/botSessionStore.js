/**
 * Bot session store — backs the onboarding/interest wizard FSM (§7).
 * Stored in Redis in prod; in-memory Map in tests.
 *
 * Shape:
 * {
 *   step: 'select_language' | 'share_contact' | 'select_bank' | ...,
 *   languageChoice: 'en' | 'am',
 *   phoneNumber: string,
 *   telegramUsername: string | null,
 *   pendingBankId: number,
 *   pendingRegionId: number,
 *   pendingZoneId: number,
 *   branchName: string,
 *   neighborhood: string,
 *   pendingGradeBand: string,
 *   pendingGradeId: number,
 *   selectedInterestLocationIds: number[],
 *   viewingRegionId: number | null,
 * }
 */
const { getBackend } = require('../utils/cache');
const config = require('../config');

const SESSION_TTL_SECONDS = config.business.botSessionTtlHours * 3600;

function keyFor(telegramId) {
  return `bot:session:${telegramId}`;
}

async function get(telegramId) {
  const cache = await getBackend();
  const raw = await cache.get(keyFor(telegramId));
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

async function set(telegramId, session) {
  const cache = await getBackend();
  const value = typeof session === 'string' ? session : JSON.stringify(session);
  await cache.set(keyFor(telegramId), value, SESSION_TTL_SECONDS);
}

async function update(telegramId, patch) {
  const current = (await get(telegramId)) || {};
  const next = { ...current, ...patch };
  await set(telegramId, next);
  return next;
}

async function clear(telegramId) {
  const cache = await getBackend();
  await cache.del(keyFor(telegramId));
}

module.exports = { get, set, update, clear, keyFor };
