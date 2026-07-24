// MatchBadges — display mutual / zone / region / grade match signals.
// Extracted from CandidateCard for composability.

import { CheckCircle2, MapPin, Globe, TrendingUp } from 'lucide-react';
import { Badge } from '../../components/ui';
import { useLang } from '../../lib/i18n';
import { cn } from '../../lib/utils';
import type { MarketplaceCard } from '../../types';

interface MatchBadgesProps {
  card: MarketplaceCard;
  className?: string;
}

export function MatchBadges({ card, className }: MatchBadgesProps) {
  const { t } = useLang();

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {card.is_mutual && (
        <Badge
          tone="green"
          icon={<CheckCircle2 size={11} strokeWidth={2.5} />}
          className="animate-[badge-pop_0.15s_ease-out]"
        >
          {t('marketplace.mutual')}
        </Badge>
      )}
      {card.match_type === 'zone' && (
        <Badge tone="blue" icon={<MapPin size={11} />}>
          {t('marketplace.matchZone')}
        </Badge>
      )}
      {card.match_type === 'region' && (
        <Badge tone="yellow" icon={<Globe size={11} />}>
          {t('marketplace.matchRegion')}
        </Badge>
      )}
      <Badge tone="gray" icon={<TrendingUp size={11} />}>
        {t('marketplace.gradeMatch')}
      </Badge>
    </div>
  );
}
