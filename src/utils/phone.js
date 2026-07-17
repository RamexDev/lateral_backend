/**
 * Phone normalization — strip whitespace, ensure leading "+" preserved.
 * Used by onboarding (contact-share) and admin user search.
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return phone;
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;
  // Collapse internal whitespace, keep leading +.
  return trimmed.replace(/\s+/g, '');
}

/**
 * Mask phone for list views (SEC-006 — list view never returns full phone).
 * "+251911223344" → "+251911***344"
 */
function maskPhone(phone) {
  if (!phone || phone.length < 6) return phone;
  const head = phone.slice(0, phone.length - 6);
  const tail = phone.slice(-3);
  return `${head}***${tail}`;
}

module.exports = { normalizePhone, maskPhone };
