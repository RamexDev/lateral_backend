// Marketplace user card — the heart of the monetization surface.
//
// Design goals (per the brief):
//   - Photo prominent
//   - Name (or tasteful masked placeholder) as the headline
//   - Match badges (mutual / zone / region) visually distinct
//   - Supporting details (grade, location, branch, neighborhood) secondary
//   - A confident "Unlock contact" CTA showing the price
//   - Purchased cards get a "revealed" treatment, not just different text
//
// Data source: MarketplaceCard from types.ts, verified against
// src/modules/marketplace/cardSerializer.js. Note `id` (not `user_id`),
// `purchased` (not `is_purchased`), and flat `grade`/`region`/`zone` fields.

import { maskedOrLocalized, localizedField, useLang } from '../../i18n';
import { Badge, Button } from '../../ui';
import { cn, formatGrade, initials } from '../../utils';
import { resolveAssetUrl } from '../../api';
import { DEFAULT_REVEAL_PRICE_ETB } from '../../env';
import type { MarketplaceCard } from '../../types';

export function UserCard({
  card,
  revealPrice,
  onUnlock
}: {
  card: MarketplaceCard;
  // Real price from POST /purchases response, if known. Falls back to default.
  revealPrice?: { amount: number; currency: string } | null;
  onUnlock: (card: MarketplaceCard) => void;
}) {
  const { lang, t } = useLang();

  // Localized-or-masked fields. "*" means paywalled.
  const name = maskedOrLocalized(card, 'full_name', lang);
  const branch = maskedOrLocalized(card, 'branch_name', lang);
  const neighborhood = maskedOrLocalized(card, 'neighborhood', lang);

  const isMasked = card.purchased === false; // Backend uses `purchased`, not `is_purchased`.
  const isRevealed = card.purchased === true;

  // Photo URL — always real, never masked. Backend serves at /avatars/...
  const photoUrl = resolveAssetUrl(card.photo_url);

  // Grade display: "Grade 5 · Associate" (localized).
  const gradeLabel = formatGrade(card.grade, lang);

  // Location display: zone (preferred) or region.
  const locationLabel = localizedField(
    {
      name_en: card.zone_en,
      name_am: card.zone_am
    },
    'name',
    lang
  ) || localizedField(
    {
      name_en: card.region_en,
      name_am: card.region_am
    },
    'name',
    lang
  );

  // Price string for the CTA. Falls back to documented default.
  const priceAmount = revealPrice?.amount ?? DEFAULT_REVEAL_PRICE_ETB;
  const priceCurrency = revealPrice?.currency ?? 'ETB';
  const priceString = `${priceAmount.toLocaleString('en-ET')} ${priceCurrency}`;

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-surface shadow-[0_1px_3px_rgba(17,24,39,0.06)] transition-shadow duration-[var(--duration-base)] hover:shadow-[0_4px_12px_rgba(17,24,39,0.08)]',
        isRevealed ? 'border-brand/30' : 'border-line'
      )}
    >
      {/* Purchased ribbon — only on revealed cards */}
      {isRevealed ? (
        <div className="absolute right-0 top-0 rounded-bl-xl bg-brand px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide text-white">
          {t('purchased')}
        </div>
      ) : null}

      <div className="p-4">
        {/* Top row: photo + headline + badges */}
        <div className="flex items-start gap-3">
          {/* Photo or initials placeholder */}
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              loading="lazy"
              className={cn(
                'h-16 w-16 shrink-0 rounded-2xl object-cover',
                isMasked && 'ring-1 ring-line'
              )}
            />
          ) : (
            <div
              className={cn(
                'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold',
                isRevealed
                  ? 'bg-brand-light text-brand-dark'
                  : 'bg-surface-muted text-ink-muted'
              )}
            >
              {isMasked ? '?' : initials(name)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Headline name */}
            <h3
              className={cn(
                'truncate text-lg font-semibold',
                isMasked ? 'text-ink-muted' : 'text-ink'
              )}
            >
              {isMasked ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  {t('maskedName')}
                </span>
              ) : (
                name || t('maskedName')
              )}
            </h3>

            {/* Grade + location, secondary */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
              {gradeLabel ? (
                <span className="inline-flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {gradeLabel}
                </span>
              ) : null}
              {locationLabel ? (
                <span className="inline-flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {locationLabel}
                </span>
              ) : null}
            </div>

            {/* Match badges */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {card.is_mutual ? (
                <Badge tone="green">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('mutual')}
                </Badge>
              ) : null}
              {card.match_type === 'zone' ? (
                <Badge tone="blue">{t('matchZone')}</Badge>
              ) : card.match_type === 'region' ? (
                <Badge tone="yellow">{t('matchRegion')}</Badge>
              ) : null}
            </div>
          </div>
        </div>

        {/* Supporting details — branch + neighborhood, masked or real */}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <div>
            <dt className="text-ink-faint">{t('branch')}</dt>
            <dd
              className={cn(
                'truncate font-medium',
                branch === '*' ? 'text-ink-faint' : 'text-ink'
              )}
            >
              {branch || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">{t('neighborhood')}</dt>
            <dd
              className={cn(
                'truncate font-medium',
                neighborhood === '*' ? 'text-ink-faint' : 'text-ink'
              )}
            >
              {neighborhood || '—'}
            </dd>
          </div>
        </dl>

        {/* Revealed contact block — only for purchased cards */}
        {isRevealed ? (
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-brand-tint px-3 py-2 text-xs">
            <div>
              <dt className="text-ink-faint">{t('phone')}</dt>
              <dd className="truncate font-semibold text-ink">
                {card.phone_number || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">{t('telegram')}</dt>
              <dd className="truncate font-semibold text-ink">
                {card.telegram_username ? `@${card.telegram_username}` : '—'}
              </dd>
            </div>
          </div>
        ) : (
          /* Unlock CTA — the monetization moment */
          <Button
            variant="accent"
            fullWidth
            size="lg"
            className="mt-4"
            onClick={() => onUnlock(card)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {t('unlockCta')} · {priceString}
          </Button>
        )}
      </div>
    </article>
  );
}

// ─── Skeleton variant for loading states ───────────────────────────────────
export function UserCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="skeleton h-16 w-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-3 w-1/2 rounded" />
          <div className="flex gap-1.5">
            <div className="skeleton h-5 w-16 rounded-full" />
            <div className="skeleton h-5 w-14 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="skeleton h-8 rounded" />
        <div className="skeleton h-8 rounded" />
      </div>
      <div className="skeleton mt-4 h-11 rounded-lg" />
    </div>
  );
}
