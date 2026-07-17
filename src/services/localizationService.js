/**
 * LocalizationService — single call site every response builder & error handler goes through.
 * See backend.md §16.2 (message catalog) and §16.3 (resolving lang per request).
 *
 * The error envelope's `code` field stays a stable, English, uppercase identifier always.
 * Only `message` is resolved through the catalog.
 */
const en = require('../i18n/en.json');
const am = require('../i18n/am.json');

const catalogs = { en, am };

/**
 * @param {string} key       Catalog key (e.g. "CONTACT_NOT_SELF" or "onboarding.welcome").
 * @param {string} lang      'en' | 'am'
 * @param {object} [params]  { placeholder: value } for {placeholder} substitution.
 * @returns {string} resolved string (falls back to English then to the key itself).
 */
function t(key, lang = 'en', params) {
  const cat = catalogs[lang] || catalogs.en;
  let str = cat[key] ?? catalogs.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

module.exports = { t };
