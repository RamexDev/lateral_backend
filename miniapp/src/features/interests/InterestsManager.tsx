// Interests manager.
//
// UX rules (enforced client-side for good UX, but backend has final say):
//   - Max 3 distinct regions
//   - Max 3 zones per region
//   - A region cannot have BOTH a broad interest AND specific zones
//     (zones override broad for that region)
//   - Picking a zone implies its region
//
// Implementation note: the backend's GET /interests/options only returns
// zones for ONE region at a time. To make the picker feel native, we let the
// user pick a region first, then show its zones. Selected interests live in
// local state until the user saves.

import { useEffect, useMemo, useState } from 'react';
import { getInterestOptions, getMyInterests, saveInterests } from '../../api';
import { localizedField, useLang, type TranslationKey } from '../../i18n';
import { Badge, Button, Card, Select, Spinner } from '../../ui';
import { SEEDED_REGIONS } from '../../regions';
import { normalizeInterests } from '../../validation';
import type { Interest, InterestOptionsResponse, Lang } from '../../types';

export function InterestsManager() {
  const { t, lang } = useLang();

  const [current, setCurrent] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [addRegionId, setAddRegionId] = useState('');
  const [addZoneId, setAddZoneId] = useState('');
  const [options, setOptions] = useState<InterestOptionsResponse | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Load current interests on mount.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyInterests()
      .then(data => {
        if (!cancelled) {
          setCurrent(
            data.interests.map(i => ({
              region_id: i.region_id,
              zone_id: i.zone_id,
              region_name: i.region_name,
              region_name_am: i.region_name_am,
              zone_name: i.zone_name,
              zone_name_am: i.zone_name_am
            }))
          );
        }
      })
      .catch(() => {
        // If load fails, leave the list empty — user can still add new ones.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load zone options when the picker's selected region changes.
  useEffect(() => {
    if (!addRegionId) {
      setOptions(null);
      return;
    }
    let cancelled = false;
    setOptionsLoading(true);
    getInterestOptions(Number(addRegionId))
      .then(data => {
        if (!cancelled) setOptions(data);
      })
      .catch(() => {
        if (!cancelled) setOptions(null);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addRegionId]);

  // Distinct region count for the "max 3 regions" rule.
  const distinctRegionCount = useMemo(
    () => new Set(current.map(i => i.region_id)).size,
    [current]
  );

  // Would adding this region exceed the 3-region cap?
  function canAddRegion(regionId: number): boolean {
    if (current.some(i => i.region_id === regionId)) return true; // Already have it
    return distinctRegionCount < 3;
  }

  // Count zones already selected for a region.
  function zoneCountForRegion(regionId: number): number {
    return current.filter(i => i.region_id === regionId && i.zone_id != null).length;
  }

  // Does this region currently have a broad interest?
  function hasBroadForRegion(regionId: number): boolean {
    return current.some(i => i.region_id === regionId && i.zone_id == null);
  }

  // Add the currently-picked region/zone to local state.
  function addInterest() {
    setAddError(null);
    if (!addRegionId) {
      setAddError(t('pickRegionFirst'));
      return;
    }
    const regionId = Number(addRegionId);

    // Region cap check.
    if (!canAddRegion(regionId)) {
      setAddError(t('allRegionsFull'));
      return;
    }

    // Broad-region add.
    if (!addZoneId) {
      // If the region already has zones, adding a broad interest is forbidden.
      if (zoneCountForRegion(regionId) > 0) {
        setAddError(t('broadWithZones'));
        return;
      }
      // Skip if broad already exists for this region.
      if (hasBroadForRegion(regionId)) {
        setAddZoneId('');
        return;
      }
      const next = [...current, { region_id: regionId, zone_id: null }];
      setCurrent(next);
      setAddZoneId('');
      return;
    }

    // Zone add.
    const zoneId = Number(addZoneId);

    // Zone cap check.
    if (zoneCountForRegion(regionId) >= 3) {
      setAddError(t('regionFull'));
      return;
    }

    // If a broad interest exists for this region, zones override it — drop broad.
    let next = current.filter(
      i => !(i.region_id === regionId && i.zone_id == null)
    );
    // Skip duplicates.
    if (!next.some(i => i.region_id === regionId && i.zone_id === zoneId)) {
      next = [...next, { region_id: regionId, zone_id: zoneId }];
    }
    setCurrent(next);
    setAddZoneId('');
  }

  // Remove a single interest by index.
  function removeInterest(index: number) {
    setCurrent(prev => prev.filter((_, i) => i !== index));
  }

  // Save to backend.
  async function onSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const normalized = normalizeInterests(current);
      await saveInterests(normalized);
      setCurrent(normalized);
      setSaved(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('error');
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <Spinner full />
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-base font-semibold text-ink">{t('interests')}</h2>
      <p className="mb-4 text-xs text-ink-muted">{t('interestsSubtitle')}</p>

      {/* Picker row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Select
          label={t('region')}
          value={addRegionId}
          onChange={e => {
            setAddRegionId(e.target.value);
            setAddZoneId('');
            setAddError(null);
          }}
          className="mb-0"
        >
          <option value="">{t('selectOption')}</option>
          {SEEDED_REGIONS.map(r => {
            const disabled = !canAddRegion(r.id);
            return (
              <option key={r.id} value={r.id} disabled={disabled}>
                {lang === 'am' ? r.name_am : r.name}
              </option>
            );
          })}
        </Select>

        <Select
          label={`${t('zone')} (${t('optional')})`}
          value={addZoneId}
          onChange={e => setAddZoneId(e.target.value)}
          disabled={!addRegionId || optionsLoading}
          className="mb-0"
        >
          <option value="">{t('broadRegion')}</option>
          {options?.zones.map(zone => {
            const label =
              lang === 'am'
                ? (zone.name_am || zone.name)
                : (zone.name || zone.name_am);
            return (
              <option key={zone.id} value={zone.id}>
                {label}
              </option>
            );
          })}
        </Select>

        <div className="flex items-end">
          <Button
            variant="secondary"
            fullWidth
            onClick={addInterest}
            disabled={!addRegionId}
          >
            {t('addInterest')}
          </Button>
        </div>
      </div>

      {addError ? (
        <p className="mt-2 text-xs text-danger">{addError}</p>
      ) : null}

      {/* Selected list */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-ink">{t('selectedInterests')}</span>
          <Badge tone={distinctRegionCount >= 3 ? 'amber' : 'gray'}>
            {distinctRegionCount} / 3 {t('region')}
          </Badge>
        </div>

        {current.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-ink-faint">
            {t('noInterests')}
          </p>
        ) : (
          <ul className="space-y-2">
            {current.map((interest, index) => {
              const region = SEEDED_REGIONS.find(r => r.id === interest.region_id);
              const regionLabel = region
                ? (lang === 'am' ? region.name_am : region.name)
                : `#${interest.region_id}`;

              // For zone label, look up in cached options if it matches the region.
              let zoneLabel: string | null = null;
              if (interest.zone_id != null) {
                const zoneFromOptions = options?.zones.find(z => z.id === interest.zone_id);
                if (zoneFromOptions) {
                  const am = zoneFromOptions.name_am ?? zoneFromOptions.name ?? null;
                  const en = zoneFromOptions.name ?? zoneFromOptions.name_am ?? null;
                  zoneLabel = lang === 'am' ? am : en;
                } else if (interest.zone_name) {
                  const am = interest.zone_name_am ?? interest.zone_name ?? null;
                  const en = interest.zone_name ?? interest.zone_name_am ?? null;
                  zoneLabel = lang === 'am' ? am : en;
                } else {
                  zoneLabel = `#${interest.zone_id}`;
                }
              }

              return (
                <li
                  key={`${interest.region_id}-${interest.zone_id ?? 'broad'}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {regionLabel}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">
                      {zoneLabel ?? t('broadRegion')}
                    </span>
                  </div>
                  <button
                    onClick={() => removeInterest(index)}
                    className="shrink-0 rounded-md p-1.5 text-ink-faint transition hover:bg-red-50 hover:text-danger"
                    aria-label={t('remove')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-danger">{error}</p>
      ) : null}

      <Button
        fullWidth
        size="lg"
        className="mt-5"
        loading={saving}
        onClick={onSave}
      >
        {t('save')}
      </Button>

      {saved ? (
        <p className="mt-3 text-center text-sm text-brand-dark">{t('interestsSaved')}</p>
      ) : null}
    </Card>
  );
}
