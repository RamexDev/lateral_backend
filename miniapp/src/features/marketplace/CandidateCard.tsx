// CandidateCard — the heart of the marketplace.
// Shows: photo, name (or masked placeholder), grade, location, match badges,
// relevance indicator, supporting details, and either the revealed contact
// block or the "Unlock contact" CTA.

import { useState, useEffect } from 'react';
import { Lock, MapPin, Phone, Send, Building2, Clock } from 'lucide-react';
import { Card, Badge } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useLang } from '../../lib/i18n';
import { resolveAssetUrl } from '../../lib/api/endpoints';
import { localizedField, maskedOrLocalized, isMaskedValue } from '../../lib/i18n/localize';
import { getInitials, cn } from '../../lib/utils';
import { MatchBadges } from './MatchBadges';
import { RelevanceIndicator } from './RelevanceIndicator';
import { RevealButton } from './RevealButton';
import { ShortlistButton } from './ShortlistButton';
import { useConfig } from '../../lib/hooks';
import type { MarketplaceCard as CardType } from '../../types';

interface CandidateCardProps {
  card: CardType;
  onUnlock: (card: CardType) => void;
  // Optional override for the price (cached from a previous purchase response).
  resolvedPrice?: { amount: number; currency: string };
  // Stagger animation delay (ms) — used by parent list for the cascade.
  index?: number;
  // Called when shortlist state changes (used by ShortlistPage to refresh).
  onShortlistChange?: (candidateId: number, isShortlisted: boolean) => void;
}

export function CandidateCard({ card, onUnlock, resolvedPrice, index = 0, onShortlistChange }: CandidateCardProps) {
  const { me } = useAuth();
  const { lang, t } = useLang();
  const { config } = useConfig();

  const [optimisticShortlisted, setOptimisticShortlisted] = useState(Boolean(card.is_shortlisted));

  useEffect(() => {
    setOptimisticShortlisted(Boolean(card.is_shortlisted));
  }, [card.is_shortlisted]);

  const isPurchased = card.purchased;
  const isViewed = Boolean(card.viewed_at);

  // Name: if purchased, show localized real name. If masked, show placeholder.
  const name = isPurchased
    ? localizedField(card, 'full_name', lang) || localizedField(card, 'full_name', 'en')
    : maskedOrLocalized(card, 'full_name', lang);

  const branch = isPurchased ? localizedField(card, 'branch_name', lang) : '';
  const neighborhood = isPurchased ? localizedField(card, 'neighborhood', lang) : '';
  const phone = card.phone_number;
  const telegram = card.telegram_username;

  const locationStr = `${localizedField(card, 'zone', lang) || card.zone_en}, ${localizedField(card, 'region', lang) || card.region_en}`;
  const gradeLabel = card.grade ? `${card.grade.band_label_en} · ${t('card.gradeLabel')} ${card.grade.number}` : '';

  // Stagger delay — cap at 320ms.
  const staggerDelay = Math.min(index * 40, 320);

  return (
    <Card
      padded={false}
      className={cn(
        'card-stagger overflow-hidden',
        isPurchased ? 'border-brand/30' : 'border-line'
      )}
      // @ts-expect-error — inline style for stagger delay
      style={{ animationDelay: `${staggerDelay}ms` }}
    >
      {/* Top section: photo + headline + badges */}
      <div className="flex gap-3 p-4">
        {/* Photo */}
        <div className="relative shrink-0">
          {card.photo_url ? (
            <img
              src={resolveAssetUrl(card.photo_url, config.photo_base_url)}
              alt={isPurchased ? name : t('card.maskedName')}
              className={cn(
                'h-14 w-14 rounded-full object-cover',
                !isPurchased && 'ring-1 ring-line grayscale-[20%]'
              )}
              loading="lazy"
            />
          ) : (
            <div
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-ink-muted',
                !isPurchased && 'ring-1 ring-line'
              )}
            >
              {isPurchased ? getInitials(name) : '?'}
            </div>
          )}
          {/* Viewed tag */}
          {isViewed && !isPurchased && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-surface-muted px-1.5 py-0.5 text-2xs font-semibold text-ink-faint shadow-sm">
              {t('marketplace.viewed')}
            </span>
          )}
          {/* Purchased ribbon */}
          {isPurchased && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-brand px-1.5 py-0.5 text-2xs font-bold text-white shadow-sm">
              {t('marketplace.purchased')}
            </span>
          )}
        </div>

        {/* Headline */}
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-0.5">
              {isPurchased ? (
                <h3 className="text-base font-semibold leading-tight text-ink">{name}</h3>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Lock size={12} className="text-ink-faint" />
                  <span className="text-sm font-medium text-ink-faint">{t('card.maskedName')}</span>
                </div>
              )}
              {gradeLabel && (
                <p className="text-xs text-ink-muted">{gradeLabel}</p>
              )}
            </div>
            {/* Shortlist button — only for non-purchased cards */}
            {!isPurchased && (
              <ShortlistButton
                candidateId={card.id}
                isShortlisted={optimisticShortlisted}
                onChange={(newState) => {
                  setOptimisticShortlisted(newState);
                  onShortlistChange?.(card.id, newState);
                }}
              />
            )}
          </div>

          {/* Location */}
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <MapPin size={11} className="shrink-0" />
            <span className="truncate">{locationStr}</span>
          </div>

          {/* Match badges */}
          <MatchBadges card={card} />

          {/* Relevance indicator (F.5) */}
          {card.relevance_score !== undefined && card.relevance_score > 0 && (
            <RelevanceIndicator score={card.relevance_score} />
          )}
        </div>
      </div>

      {/* Supporting details — only when purchased */}
      {isPurchased && (branch || neighborhood) && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm">
          {branch && (
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                {t('card.branch')}
              </dt>
              <dd className="flex items-center gap-1 text-ink">
                <Building2 size={12} className="shrink-0 text-ink-faint" />
                <span className="truncate">{branch}</span>
              </dd>
            </div>
          )}
          {neighborhood && (
            <div>
              <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
                {t('card.neighborhood')}
              </dt>
              <dd className="truncate text-ink">{neighborhood}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Contact block — only when purchased */}
      {isPurchased && (!isMaskedValue(phone) || !isMaskedValue(telegram)) && (
        <div className="space-y-2 bg-brand-tint px-4 py-3">
          {!isMaskedValue(phone) && phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2 text-sm font-medium text-brand-dark hover:underline"
            >
              <Phone size={14} className="shrink-0" />
              <span className="tabular-nums">{phone}</span>
            </a>
          )}
          {!isMaskedValue(telegram) && telegram && (
            <a
              href={`https://t.me/${telegram.replace(/^@/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-brand-dark hover:underline"
            >
              <Send size={14} className="shrink-0" />
              <span>@{telegram.replace(/^@/, '')}</span>
            </a>
          )}
        </div>
      )}

      {/* Unlock CTA — only when not purchased */}
      {!isPurchased && (
        <div className="border-t border-line p-4">
          <RevealButton
            onClick={() => onUnlock(card)}
            resolvedPrice={resolvedPrice?.amount}
            resolvedCurrency={resolvedPrice?.currency}
          />
        </div>
      )}
    </Card>
  );
}
