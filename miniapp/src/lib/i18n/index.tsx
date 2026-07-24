// i18n provider and hooks.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { en, type Dictionary } from './en';
import { am } from './am';

export type Lang = 'en' | 'am';

const dictionaries: Record<Lang, Dictionary> = { en, am };

// Flatten nested-key style strings (e.g. 'completeness.missingField.full_name')
// into the dictionary lookup.
function lookup(dict: Dictionary, key: string): string | undefined {
  // Direct key match first.
  if (key in dict) {
    return dict[key as keyof Dictionary];
  }
  return undefined;
}

// Translate a key with optional variable interpolation.
// Interpolation is naive string replacement: {var} → value.
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const dict = dictionaries[lang];
  let value = lookup(dict, key);

  // Fall back to the other language.
  if (value === undefined) {
    const otherDict = dictionaries[lang === 'en' ? 'am' : 'en'];
    value = lookup(otherDict, key);
  }

  // Fall back to the literal key if not found anywhere.
  if (value === undefined) {
    return key;
  }

  // Interpolate variables.
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.split('{' + k + '}').join(String(v));
    }
  }

  return value;
}

// Translation key type — all keys from the English dictionary.
export type TranslationKey = keyof Dictionary;

// Re-export Dictionary type for convenience.
export type { Dictionary };

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  lang: Lang;
  setLang: (lang: Lang) => void;
  children: ReactNode;
}

export function LanguageProvider({ lang, setLang, children }: LanguageProviderProps) {
  const value = useMemo<LanguageContextValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    return { lang, setLang, t };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLang must be used inside a LanguageProvider');
  }
  return ctx;
}

export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  return useLang().t;
}
