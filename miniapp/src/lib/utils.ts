// Misc utility helpers.

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merge Tailwind class names with conflict resolution.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Format an ETB amount with thousands separators.
export function formatEtb(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return Number(amount).toLocaleString('en-ET');
}

// Format an ISO date string as a relative time (e.g. "2h ago", "just now").
export function formatRelativeTime(iso: string | null | undefined, lang: 'en' | 'am' = 'en'): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (lang === 'am') {
    if (diffSec < 60) return 'አሁን';
    if (diffMin < 60) return `ከ${diffMin} ደቂቃ በፊት`;
    if (diffHr < 24) return `ከ${diffHr} ሰዓት በፊት`;
    if (diffDay === 1) return 'ትናንት';
    if (diffDay < 7) return `ከ${diffDay} ቀን በፊት`;
    return date.toLocaleDateString('am-ET');
  }

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Format an ISO date string as a localized absolute date.
export function formatDate(iso: string | null | undefined, lang: 'en' | 'am' = 'en'): string {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-ET', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Convert a string to initials for avatar placeholders.
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Debounce a function call.
export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  }) as T;
}
