// Purchase modal — initiates a paid contact reveal.
//
// Flow:
//   1. Confirm screen: shows price (default 500 ETB), confirms intent.
//   2. POST /purchases — backend creates a pending purchase + payment record,
//      returns checkout_url + amount + currency.
//   3. Pending screen: tells the user a payment window was opened (we try to
//      open it via Telegram's openLink or window.open). The user can refresh
//      status — in dev with mock Chapa credentials, the payment never
//      auto-completes, so we gracefully stay pending.
//
// We never assume the payment will flip to completed on its own. The user
// returns to the Purchases tab or the marketplace to see the revealed state.

import { useState } from 'react';
import { createPurchase, resolveAssetUrl } from '../../api';
import { DEFAULT_REVEAL_PRICE_ETB } from '../../env';
import { maskedOrLocalized, useLang } from '../../i18n';
import { openExternalLink } from '../../telegram';
import { Button, Modal } from '../../ui';
import { formatGrade, initials } from '../../utils';
import type { MarketplaceCard } from '../../types';

type Stage = 'confirm' | 'pending' | 'error';

export function PurchaseModal({
  card,
  onClose,
  onPurchased,
  onPriceResolved
}: {
  card: MarketplaceCard;
  onClose: () => void;
  // Called after the user taps "Check status" — gives the parent a chance to
  // refresh the list (the purchase may have completed by now).
  onPurchased: () => void;
  // Called when the backend returns the authoritative price for this card.
  onPriceResolved?: (cardId: number, amount: number, currency: string) => void;
}) {
  const { t, lang } = useLang();

  const [stage, setStage] = useState<Stage>('confirm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once POST /purchases returns, this holds the real price from the backend.
  const [resolvedPrice, setResolvedPrice] =
    useState<{ amount: number; currency: string } | null>(null);

  // Display name for the candidate — masked until purchased, but we still
  // have one of the language values to show ("*" if masked).
  const name = maskedOrLocalized(card, 'full_name', 'en');
  const photoUrl = resolveAssetUrl(card.photo_url);

  // Confirm → POST /purchases.
  async function onConfirm() {
    setLoading(true);
    setError(null);
    try {
      const purchase = await createPurchase(card.id);

      // The backend response is the authoritative price source.
      const price = { amount: purchase.amount, currency: purchase.currency };
      setResolvedPrice(price);
      onPriceResolved?.(card.id, price.amount, price.currency);

      // Open the checkout URL via Telegram's openLink when available.
      if (purchase.checkout_url) {
        openExternalLink(purchase.checkout_url);
      }

      setStage('pending');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('purchaseFailed');
      setError(message);
      setStage('error');
    } finally {
      setLoading(false);
    }
  }

  // Price string for display. Falls back to documented default before
  // the POST returns a real amount.
  const priceAmount = resolvedPrice?.amount ?? DEFAULT_REVEAL_PRICE_ETB;
  const priceCurrency = resolvedPrice?.currency ?? 'ETB';
  const priceString = `${priceAmount.toLocaleString('en-ET')} ${priceCurrency}`;

  return (
    <Modal open title={t('unlock')} onClose={onClose} closeOnBackdrop={false}>
      {/* Candidate summary at top */}
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-surface-muted p-3">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="h-12 w-12 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-sm font-semibold text-ink-muted">
            {initials(name)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {name === '*' ? t('maskedName') : (name || t('maskedName'))}
          </p>
          {formatGrade(card.grade, lang) ? (
            <p className="truncate text-xs text-ink-muted">
              {formatGrade(card.grade, lang)}
            </p>
          ) : null}
        </div>
      </div>

      {stage === 'confirm' ? (
        <>
          <p className="mb-2 text-sm text-ink-muted">{t('unlockBody')}</p>
          <p className="mb-4 text-sm text-ink-muted">{t('unlockConfirm')}</p>

          {/* Price emphasis */}
          <div className="mb-5 rounded-xl bg-accent-light px-4 py-3 text-center">
            <p className="text-2xs font-medium uppercase tracking-wide text-accent-dark">
              {t('unlockFor')}
            </p>
            <p className="text-2xl font-bold text-accent-dark">{priceString}</p>
          </div>

          {error ? (
            <p className="mb-3 text-sm text-danger">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              variant="accent"
              fullWidth
              loading={loading}
              onClick={onConfirm}
            >
              {t('confirm')} · {priceString}
            </Button>
          </div>
        </>
      ) : null}

      {stage === 'pending' ? (
        <div className="pop-enter text-center">
          {/* Visual confirmation that the request went through */}
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-light">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-dark">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <p className="mb-1 text-sm font-medium text-ink">
            {t('purchasePending')}
          </p>
          <p className="mb-4 text-sm text-ink-muted">
            {t('paymentOpened')}
          </p>

          <Button
            fullWidth
            onClick={() => {
              onPurchased();
              onClose();
            }}
          >
            {t('checkStatus')}
          </Button>
        </div>
      ) : null}

      {stage === 'error' ? (
        <>
          <p className="mb-4 text-sm text-danger">{error ?? t('purchaseFailed')}</p>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setError(null);
                setStage('confirm');
              }}
            >
              {t('retry')}
            </Button>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
