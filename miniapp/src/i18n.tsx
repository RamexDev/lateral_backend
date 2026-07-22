import {
  createContext,
  useContext,
  useMemo,
  type ReactNode
} from 'react';

import type { Lang } from './types';

// ─── English dictionary ────────────────────────────────────────────────────
const en = {
  // Generic
  loading: 'Loading…',
  error: 'Something went wrong.',
  retry: 'Retry',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  confirm: 'Confirm',
  delete: 'Delete',
  remove: 'Remove',
  refresh: 'Refresh',
  backToTop: 'Back to top',
  optional: 'optional',
  or: 'or',

  // Tabs
  tabFeed: 'Feed',
  tabPeople: 'People',
  tabPurchases: 'Purchases',
  tabProfile: 'Profile',

  // Language toggle
  langToggleToAm: 'አማ',
  langToggleToEn: 'EN',

  // Auth / dev login
  devLogin: 'Developer login',
  devLoginSubtitle:
    'Sign in with a Telegram ID, or paste a JWT issued by the backend.',
  telegramId: 'Telegram ID',
  telegramIdHint: 'Numeric ID. The user must already exist in the database.',
  token: 'JWT token',
  login: 'Log in',
  loginWithTelegramId: 'Log in with Telegram ID',
  loginWithToken: 'Log in with token',
  devLoginDisabled: 'Development login is disabled.',
  signingIn: 'Signing in…',

  // Profile
  completeProfile: 'Complete your profile',
  completeProfileSubtitle:
    'The marketplace unlocks once your profile is complete.',
  profile: 'Profile',
  fullNameEn: 'Full name (English)',
  fullNameAm: 'Full name (Amharic)',
  branchNameEn: 'Branch name (English)',
  branchNameAm: 'Branch name (Amharic)',
  neighborhoodEn: 'Neighborhood (English)',
  neighborhoodAm: 'Neighborhood (Amharic)',
  grade: 'Grade',
  region: 'Region',
  zone: 'Zone',
  language: 'Language',
  photo: 'Photo',
  uploadPhoto: 'Upload photo',
  changePhoto: 'Change photo',
  deletePhoto: 'Delete photo',
  bank: 'Bank',
  currentLocation: 'Current location',
  selectOption: 'Select…',
  saved: 'Saved.',
  profileUpdated: 'Profile updated.',
  photoUpdated: 'Photo updated.',
  photoDeleted: 'Photo removed.',
  signOut: 'Sign out',
  signOutConfirm: 'Sign out and clear this session?',

  // Completeness
  completeness: 'Profile completeness',
  completenessComplete: 'Your profile is complete.',
  completenessIncomplete:
    'Complete the highlighted fields to unlock the marketplace.',
  completenessScore: '{score}% complete',
  missingField: {
    full_name: 'Full name',
    branch_name: 'Branch name',
    neighborhood: 'Neighborhood',
    grade: 'Grade',
    transfer_interest: 'A transfer interest',
    custom_photo: 'A custom photo'
  },

  // Interests
  interests: 'Transfer interests',
  interestsSubtitle:
    'Where would you like to transfer? Choose up to 3 regions, with up to 3 zones each.',
  addInterest: 'Add',
  noInterests: 'No transfer interests yet.',
  broadRegion: 'Whole region (any zone)',
  selectedInterests: 'Selected interests',
  maxRegions: 'Maximum 3 regions allowed.',
  maxZonesPerRegion: 'Maximum 3 zones per region allowed.',
  broadWithZones:
    'A region cannot have both a whole-region interest and specific zones.',
  interestsSaved: 'Interests saved.',
  pickRegionFirst: 'Pick a region first.',
  regionFull: 'This region is full. Remove a zone to add another.',
  allRegionsFull: 'Region limit reached. Remove one region to add another.',

  // Marketplace
  mutual: 'Mutual',
  matchZone: 'Zone match',
  matchRegion: 'Region match',
  purchased: 'Unlocked',
  unlock: 'Unlock contact',
  unlockCta: 'Unlock contact',
  unlockFor: 'Unlock for',
  unlockPrice: 'Unlock for {amount} {currency}',
  unlockBody:
    'Reveal this candidate\'s name, phone, Telegram, branch, and neighborhood.',
  unlockConfirm: 'You will be redirected to Chapa to complete payment.',
  purchasePending: 'Payment pending',
  paymentOpened:
    'A payment window was opened. Complete the payment, then check the status.',
  paymentOpenedNoUrl: 'Payment started. Check the status in a moment.',
  checkStatus: 'Check status',
  purchaseFailed: 'Could not start payment.',
  purchaseAlreadyExists:
    'A pending purchase already exists for this candidate.',
  contactRevealed: 'Contact unlocked',
  contactRevealedBody: 'You can now see this candidate\'s full details.',

  // Card field labels
  name: 'Name',
  branch: 'Branch',
  neighborhood: 'Neighborhood',
  phone: 'Phone',
  telegram: 'Telegram',
  gradeLabel: 'Grade',
  bandLabel: 'Band',
  location: 'Location',
  maskedName: 'Name hidden',

  // Empty / error / loading states
  noResults: 'No results found.',
  noResultsFeed: 'No one is looking to transfer into your area right now.',
  noResultsPeople: 'No one is located in your desired areas yet.',
  noResultsPurchases: 'You have not unlocked any contacts yet.',
  noResultsNotifications: 'No notifications yet.',
  requiresInterests:
    'Add transfer interests to see people in your desired areas.',
  loadingMore: 'Loading more…',

  // Purchases page
  purchasesTitle: 'Your unlocked contacts',
  purchasedOn: 'Unlocked on',

  // Notifications
  notifications: 'Notifications',
  notificationsTitle: 'Notifications',
  newNotifications: 'new',
  markAllSeen: 'Mark all as seen',
  notificationType: {
    payment_confirmation: 'Payment confirmed',
    profile_nudge: 'Profile reminder',
    broadcast: 'Announcement',
    digest: 'Digest'
  },

  // Validation
  requiredOneLanguage: 'At least one language is required.',
  branchMin: 'Branch name must be at least 3 characters.',
  neighborhoodMin: 'Neighborhood must be at least 2 characters.',
  gradeRequired: 'Grade is required.',
  regionRequired: 'Region is required.',
  zoneRequired: 'Zone is required.',
  invalidPhotoType: 'Photo must be JPEG, PNG, or WEBP.',
  invalidPhotoSize: 'Photo must be 5 MB or smaller.',
  invalidTelegramId: 'Enter a valid numeric Telegram ID.'
};

// ─── Amharic dictionary ────────────────────────────────────────────────────
const am: typeof en = {
  // Generic
  loading: 'በመጫን ላይ…',
  error: 'ስህተት ተከሰተ።',
  retry: 'እንደገና ይሞክሩ',
  save: 'አስቀምጥ',
  cancel: 'ይቅር',
  close: 'ዝጋ',
  confirm: 'አረጋግጥ',
  delete: 'ሰርዝ',
  remove: 'አስወግድ',
  refresh: 'አድስ',
  backToTop: 'ወደ ላይ ተመለስ',
  optional: 'አማራጭ',
  or: 'ወይም',

  // Tabs
  tabFeed: 'የዝውውር ፍሰት',
  tabPeople: 'አመልካቾች',
  tabPurchases: 'የተከፈቱ',
  tabProfile: 'መገለጫ',

  // Language toggle
  langToggleToAm: 'አማ',
  langToggleToEn: 'EN',

  // Auth / dev login
  devLogin: 'የገንቢ መግቢያ',
  devLoginSubtitle:
    'በቴሌግራም መለያ ቁጥር ይግቡ፣ ወይም ከባክኤንድ የተሰጠ JWT ይለጥፉ።',
  telegramId: 'የቴሌግራም መለያ ቁጥር',
  telegramIdHint:
    'ቁጥራዊ መለያ። ተጠቃሚው አስቀድሞ በመረጃ ቋቱ ውስጥ መኖር አለበት።',
  token: 'JWT ቶከን',
  login: 'ግባ',
  loginWithTelegramId: 'በቴሌግራም መለያ ቁጥር ግባ',
  loginWithToken: 'በቶከን ግባ',
  devLoginDisabled: 'የገንቢ መግቢያ ተዘግቷል።',
  signingIn: 'በመግባት ላይ…',

  // Profile
  completeProfile: 'መገለጫዎን ያሟሉ',
  completeProfileSubtitle: 'መገለጫዎ ሲሟላ ገበያው ይከፈታል።',
  profile: 'መገለጫ',
  fullNameEn: 'ሙሉ ስም (በእንግሊዝኛ)',
  fullNameAm: 'ሙሉ ስም (በአማርኛ)',
  branchNameEn: 'የቅርንጫፍ ስም (በእንግሊዝኛ)',
  branchNameAm: 'የቅርንጫፍ ስም (በአማርኛ)',
  neighborhoodEn: 'ሰፈር/አካባቢ (በእንግሊዝኛ)',
  neighborhoodAm: 'ሰፈር/አካባቢ (በአማርኛ)',
  grade: 'ደረጃ',
  region: 'ክልል',
  zone: 'ዞን',
  language: 'ቋንቋ',
  photo: 'ፎቶ',
  uploadPhoto: 'ፎቶ ጫን',
  changePhoto: 'ፎቶ ቀይር',
  deletePhoto: 'ፎቶ ሰርዝ',
  bank: 'ባንክ',
  currentLocation: 'አሁን የሚገኙበት አካባቢ',
  selectOption: 'ይምረጡ…',
  saved: 'ተቀምጧል።',
  profileUpdated: 'መገለጫ ተዘምኗል።',
  photoUpdated: 'ፎቶ ተዘምኗል።',
  photoDeleted: 'ፎቶ ተሰርዟል።',
  signOut: 'ውጣ',
  signOutConfirm: 'ከመለያዎ ወጥተው ክፍለ-ጊዜውን ማቋረጥ ይፈልጋሉ?',

  // Completeness
  completeness: 'የመገለጫ ሙሌት ደረጃ',
  completenessComplete: 'መገለጫዎ ሙሉ ነው።',
  completenessIncomplete:
    'ገበያውን ለመክፈት የተለዩትን መስኮች ይሙሉ።',
  completenessScore: '{score}% ተሞልቷል',
  missingField: {
    full_name: 'ሙሉ ስም',
    branch_name: 'የቅርንጫፍ ስም',
    neighborhood: 'ሰፈር/አካባቢ',
    grade: 'ደረጃ',
    transfer_interest: 'የዝውውር ፍላጎት',
    custom_photo: 'የራስ ፎቶ'
  },

  // Interests
  interests: 'የዝውውር ፍላጎቶች',
  interestsSubtitle:
    'ወዴት መዛወር ይፈልጋሉ? እስከ 3 ክልሎች፣ በእያንዳንዱ እስከ 3 ዞኖች ይምረጡ።',
  addInterest: 'ጨምር',
  noInterests: 'እስካሁን የተመረጠ የዝውውር ፍላጎት የለም።',
  broadRegion: 'ሙሉ ክልል (ማንኛውም ዞን)',
  selectedInterests: 'የተመረጡ ፍላጎቶች',
  maxRegions: 'ቢበዛ 3 ክልሎችን ብቻ መምረጥ ይቻላል።',
  maxZonesPerRegion: 'በአንድ ክልል ቢበዛ 3 ዞኖችን ብቻ መምረጥ ይቻላል።',
  broadWithZones:
    'አንድ ክልል በሙሉ እና የተወሰኑ ዞኖች በአንድ ላይ ሊመረጡ አይችሉም።',
  interestsSaved: 'ፍላጎቶች ተቀምጠዋል።',
  pickRegionFirst: 'መጀመሪያ ክልል ይምረጡ።',
  regionFull: 'የዚህ ክልል ቦታ ሞልቷል። ሌላ ዞን ለመጨመር አንዱን ያስወግዱ።',
  allRegionsFull:
    'የክልል ገደብ ደርሷል። ሌላ ለመጨመር አንዱን ክልል ያስወግዱ።',

  // Marketplace
  mutual: 'የሁለትዮሽ',
  matchZone: 'የዞን ተዛማጅ',
  matchRegion: 'የክልል ተዛማጅ',
  purchased: 'ተከፍቷል',
  unlock: 'የመገናኛ መረጃ ክፈት',
  unlockCta: 'የመገናኛ መረጃ ክፈት',
  unlockFor: 'ክፈት በ',
  unlockPrice: 'በ{amount} {currency} ክፈት',
  unlockBody:
    'የዚህን እጩ ስም፣ ስልክ፣ ቴሌግራም፣ ቅርንጫፍ እና ሰፈር/አካባቢ ይመልከቱ።',
  unlockConfirm: 'ክፍያውን ለማጠናቀቅ ወደ ቻፓ (Chapa) ይመራሉ።',
  purchasePending: 'ክፍያ በመጠባበቅ ላይ',
  paymentOpened:
    'የክፍያ መስኮት ተከፍቷል። ክፍያውን አጠናቅቀው ሁኔታውን ያረጋግጡ።',
  paymentOpenedNoUrl: 'ክፍያ ተጀምሯል። በቅርቡ ሁኔታውን ያረጋግጡ።',
  checkStatus: 'ሁኔታ አረጋግጥ',
  purchaseFailed: 'ክፍያ ማስጀመር አልተቻለም።',
  purchaseAlreadyExists:
    'ለዚህ እጩ በመጠባበቅ ላይ ያለ ግዢ አስቀድሞ አለ።',
  contactRevealed: 'የመገናኛ መረጃ ተከፍቷል',
  contactRevealedBody:
    'አሁን የዚህን እጩ ሙሉ ዝርዝር መረጃ ማየት ይችላሉ።',

  // Card field labels
  name: 'ስም',
  branch: 'ቅርንጫፍ',
  neighborhood: 'ሰፈር/አካባቢ',
  phone: 'ስልክ',
  telegram: 'ቴሌግራም',
  gradeLabel: 'ደረጃ',
  bandLabel: 'ምድብ',
  location: 'አካባቢ',
  maskedName: 'ስም ተደብቋል',

  // Empty / error / loading states
  noResults: 'ምንም ውጤት አልተገኘም።',
  noResultsFeed:
    'በአሁኑ ጊዜ ወደ እርስዎ አካባቢ ለመዛወር የሚፈልግ አመልካች የለም።',
  noResultsPeople:
    'እርስዎ በሚፈልጉት አካባቢዎች እስካሁን የሚገኝ አመልካች የለም።',
  noResultsPurchases:
    'እስካሁን ምንም የመገናኛ መረጃ አልከፈቱም።',
  noResultsNotifications: 'እስካሁን ምንም ማሳወቂያ የለም።',
  requiresInterests:
    'በሚፈልጉት አካባቢዎች ሰዎችን ለማየት የዝውውር ፍላጎት ይጨምሩ።',
  loadingMore: 'ተጨማሪ በመጫን ላይ…',

  // Purchases page
  purchasesTitle: 'የተከፈቱ መገናኛዎችዎ',
  purchasedOn: 'የተከፈተበት ቀን',

  // Notifications
  notifications: 'ማሳወቂያዎች',
  notificationsTitle: 'ማሳወቂያዎች',
  newNotifications: 'አዲስ',
  markAllSeen: 'ሁሉንም እንደተነበቡ ምልክት አድርግ',
  notificationType: {
    payment_confirmation: 'ክፍያ ተረጋግጧል',
    profile_nudge: 'የመገለጫ ማስታወሻ',
    broadcast: 'ማስታወቂያ',
    digest: 'ማጠቃለያ'
  },

  // Validation
  requiredOneLanguage: 'ቢያንስ አንድ ቋንቋ ያስፈልጋል።',
  branchMin: 'የቅርንጫፍ ስም ቢያንስ 3 ቁምፊዎች መሆን አለበት።',
  neighborhoodMin: 'ሰፈር/አካባቢ ቢያንስ 2 ቁምፊዎች መሆን አለበት።',
  gradeRequired: 'ደረጃ ያስፈልጋል።',
  regionRequired: 'ክልል ያስፈልጋል።',
  zoneRequired: 'ዞን ያስፈልጋል።',
  invalidPhotoType: 'ፎቶ JPEG፣ PNG ወይም WEBP መሆን አለበት።',
  invalidPhotoSize: 'ፎቶ ከ5 MB መብለጥ የለበትም።',
  invalidTelegramId: 'ትክክለኛ የቴሌግራም መለያ ቁጥር ያስገቡ።'
};

// ─── Translation key types ─────────────────────────────────────────────────

type PathKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? PathKeys<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = PathKeys<typeof en>;

export type Dictionary = typeof en;

type TranslationVariables = Record<string, string | number>;

// ─── Internal helpers ──────────────────────────────────────────────────────

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, part: string) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, source);
}

function interpolate(
  template: string,
  vars?: TranslationVariables
): string {
  if (!vars) return template;
  return Object.entries(vars).reduce((result, [key, value]) => {
    return result.split(`{${key}}`).join(String(value));
  }, template);
}

export function translate(
  lang: Lang,
  key: TranslationKey,
  vars?: TranslationVariables
): string {
  const active: Dictionary = lang === 'am' ? am : en;
  const fallback: Dictionary = lang === 'am' ? en : am;

  const primary = getByPath(active, key);
  if (isNonEmptyString(primary)) {
    return interpolate(primary, vars);
  }

  const secondary = getByPath(fallback, key);
  if (isNonEmptyString(secondary)) {
    return interpolate(secondary, vars);
  }

  return String(key);
}

// ─── React context ─────────────────────────────────────────────────────────

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: TranslationVariables) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  children: ReactNode;
}

export function LanguageProvider({
  lang,
  setLang,
  children
}: LanguageProviderProps) {
  const value = useMemo<LanguageContextValue>(() => {
    return {
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars)
    };
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);

  if (!ctx) {
    throw new Error('useLang must be used inside LanguageProvider');
  }

  return ctx;
}

export function useT() {
  return useLang().t;
}

// ─── Localized backend field helpers ───────────────────────────────────────

type Localizable = {
  [key: string]: unknown;
};

function asLocalizable<T>(item: T): Localizable {
  return item as unknown as Localizable;
}

export function isMaskedValue(value: unknown): value is string {
  return value === '*';
}

export function localizedField<T>(
  item: T | null | undefined,
  base: string,
  lang: Lang
): string {
  if (!item) return '';

  const obj = asLocalizable(item);

  const primary = obj[`${base}_${lang}`];
  if (isNonEmptyString(primary) && !isMaskedValue(primary)) {
    return primary;
  }

  const fallbackLang: Lang = lang === 'en' ? 'am' : 'en';
  const fallback = obj[`${base}_${fallbackLang}`];
  if (isNonEmptyString(fallback) && !isMaskedValue(fallback)) {
    return fallback;
  }

  if (isMaskedValue(primary) || isMaskedValue(fallback)) {
    return '*';
  }

  return '';
}

export function maskedOrLocalized<T>(
  item: T | null | undefined,
  base: string,
  lang: Lang
): string {
  if (!item) return '';

  const obj = asLocalizable(item);

  const enValue = obj[`${base}_en`];
  const amValue = obj[`${base}_am`];

  if (isMaskedValue(enValue) || isMaskedValue(amValue)) {
    return '*';
  }

  return localizedField(item, base, lang);
}

export function localizedName<T>(
  item: T | null | undefined,
  lang: Lang
): string {
  return localizedField(item, 'name', lang);
}

export function localizedAlias<T>(
  item: T | null | undefined,
  lang: Lang
): string {
  return localizedField(item, 'alias', lang);
}
