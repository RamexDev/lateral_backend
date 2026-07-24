// FilterBar — collapsible filter UI for the marketplace feed (F.7).
// Supports: mutual_only toggle, grade_band select, region select, zone select.

import { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import { Button, Select, Modal } from '../../components/ui';
import { useApi } from '../../lib/hooks';
import { getRegions, getZones } from '../../lib/api/endpoints';
import { useLang } from '../../lib/i18n';
import { localizedField } from '../../lib/i18n/localize';
import type { RegionsResponse, ZonesResponse, MarketplaceFilters } from '../../types';

interface FilterBarProps {
  filters: MarketplaceFilters;
  onChange: (filters: MarketplaceFilters) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MarketplaceFilters>(filters);

  // Sync draft when filters change externally.
  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  // Fetch regions (cached via useApi).
  const { data: regionsData } = useApi<RegionsResponse>('/api/v1/regions');
  // Fetch zones when draft.region_id changes.
  const { data: zonesData } = useApi<ZonesResponse>(
    draft.region_id ? `/api/v1/zones?region_id=${draft.region_id}` : '/api/v1/zones',
    [draft.region_id]
  );

  const hasActiveFilters = Boolean(
    filters.mutual_only || filters.grade_band || filters.region_id || filters.zone_id
  );

  const handleApply = () => {
    onChange(draft);
    setOpen(false);
  };

  const handleClear = () => {
    const cleared: MarketplaceFilters = {};
    setDraft(cleared);
    onChange(cleared);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          hasActiveFilters
            ? 'bg-brand-tint text-brand'
            : 'bg-surface-muted text-ink-muted hover:bg-line'
        }`}
      >
        <Filter size={14} />
        {t('filter.title')}
        {hasActiveFilters && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-2xs text-white">
            !
          </span>
        )}
      </button>

      <Modal open={open} title={t('filter.title')} onClose={() => setOpen(false)} variant="sheet">
        <div className="space-y-4 p-4">
          {/* Mutual only toggle */}
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">{t('filter.mutualOnly')}</span>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, mutual_only: !d.mutual_only }))}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                draft.mutual_only ? 'bg-brand' : 'bg-line-strong'
              }`}
              role="switch"
              aria-checked={draft.mutual_only}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  draft.mutual_only ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>

          {/* Grade band */}
          <Select
            label={t('filter.gradeBand')}
            value={String(draft.grade_band ?? '')}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                grade_band: e.target.value ? Number(e.target.value) : undefined
              }))
            }
          >
            <option value="">{t('filter.anyBand')}</option>
            {[1, 2, 3, 4, 5, 6].map((b) => (
              <option key={b} value={b}>
                {t('card.bandLabel')} {b}
              </option>
            ))}
          </Select>

          {/* Region */}
          <Select
            label={t('filter.region')}
            value={String(draft.region_id ?? '')}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                region_id: e.target.value ? Number(e.target.value) : undefined,
                zone_id: undefined
              }))
            }
          >
            <option value="">{t('filter.anyRegion')}</option>
            {regionsData?.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {localizedField(r, 'name', lang)}
              </option>
            ))}
          </Select>

          {/* Zone */}
          <Select
            label={t('filter.zone')}
            value={String(draft.zone_id ?? '')}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                zone_id: e.target.value ? Number(e.target.value) : undefined
              }))
            }
            disabled={!draft.region_id}
          >
            <option value="">{t('filter.anyZone')}</option>
            {zonesData?.zones
              .filter((z) => !draft.region_id || z.region_id === draft.region_id)
              .map((z) => (
                <option key={z.id} value={z.id}>
                  {localizedField(z, 'name', lang)}
                </option>
              ))}
          </Select>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" fullWidth onClick={handleClear}>
              {t('filter.clear')}
            </Button>
            <Button variant="primary" fullWidth onClick={handleApply}>
              {t('filter.apply')}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
