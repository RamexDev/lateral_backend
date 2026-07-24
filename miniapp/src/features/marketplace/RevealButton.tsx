// RevealButton — the amber "Unlock contact" CTA.
// This is the ONLY place amber is used in the entire app — it's the monetization moment.

import { Lock } from 'lucide-react';
import { Button } from '../../components/ui';
import { useConfig } from '../../lib/hooks';
import { useLang } from '../../lib/i18n';
import { formatEtb } from '../../lib/utils';

interface RevealButtonProps {
  onClick: () => void;
  loading?: boolean;
  resolvedPrice?: number;
  resolvedCurrency?: string;
}

export function RevealButton({ onClick, loading, resolvedPrice, resolvedCurrency }: RevealButtonProps) {
  const { config } = useConfig();
  const { t } = useLang();

  const amount = resolvedPrice ?? config.reveal_price_etb;
  const currency = resolvedCurrency ?? config.currency;

  return (
    <Button
      variant="accent"
      size="lg"
      fullWidth
      leftIcon={<Lock size={16} />}
      onClick={onClick}
      loading={loading}
    >
      {t('marketplace.unlockFor', { amount: formatEtb(amount), currency })}
    </Button>
  );
}
