// InterestsManager — manage transfer interests.
// Where the user wants to move. Enforces client-side UX rules (max 3 regions,
// max 3 zones/region, broad+zones mutually exclusive).

import { useEffect, useState } from 'react';
import { MapPin, Plus, Trash2, Globe } from 'lucide-react';
import { Card, Button, Select, EmptyState, Toast, Badge } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApi, useMutation } from '../../lib/hooks';
import {
  getMyInterests,
  getInterestOptions,
  saveInterests,
  getRegions
} from '../../lib/api/endpoints';
import { useLang } from '../../lib/i18n';
import { localizedField } from '../../lib/i18n/localize';
import { INTEREST_LIMITS_DEFAULT } from './limits';
import type {
  Interest,
  MyInterestsResponse,
  InterestOptionsResponse,
  InterestSaveResponse,
  RegionsResponse
} from '../../types';

const MAX_REGIONS = 3;
const MAX_ZONES_PER_REGION = 3;

export function InterestsManager() {
  const { me } = useAuth();
  const { t, lang } = useLang();

  // Fetch existing interests.
  const { data: myInterestsData, refetch: refetchMy } = useApi<MyInterestsResponse>('/api/v1/interests/me');
  // Fetch regions (F.1 — no longer hardcoded).
  const { data: regionsData } = useApi<RegionsResponse>('/api/v1/regions');

  const [current, setCurrent] = useState<Interest[]>([]);
  const [addRegionId, setAddRegionId] = useState('');
  const [addZoneId, setAddZoneId] = useState('');
  const [options, setOptions] = useState<InterestOptionsResponse | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Sync current interests from server data.
  useEffect(() => {
    if (myInterestsData?.interests) {
      setCurrent(myInterestsData.interests);
    }
  }, [myInterestsData]);

  // Fetch interest options when addRegionId changes.
  useEffect(() => {
    if (!addRegionId) {
      setOptions(null);
      return;
    }
    setOptionsLoading(true);
    getInterestOptions(Number(addRegionId))
      .then((data) => setOptions(data))
      .catch(() => setOptions(null))
      .finally(() => setOptionsLoading(false));
  }, [addRegionId]);

  const save = useMutation<{ interests: Interest[] }, InterestSaveResponse>('PUT', '/api/v1/interests/me');

  const distinctRegions = new Set(current.map((i) => i.region_id));

  const handleAdd = () => {
    setAddError('');
    if (!addRegionId) {
      setAddError(t('interests.pickRegionFirst'));
      return;
    }
    const regionIdNum = Number(addRegionId);
    const zoneIdNum = addZoneId ? Number(addZoneId) : null;

    // Check if broad region already added.
    if (zoneIdNum === null && current.some((i) => i.region_id === regionIdNum && i.zone_id === null)) {
      return; // already added
    }
    // Check specific zone already added.
    if (zoneIdNum !== null && current.some((i) => i.region_id === regionIdNum && i.zone_id === zoneIdNum)) {
      return;
    }
    // Check max regions.
    if (!distinctRegions.has(regionIdNum) && distinctRegions.size >= MAX_REGIONS) {
      setAddError(t('interests.allRegionsFull'));
      return;
    }
    // Check max zones per region.
    if (zoneIdNum !== null) {
      const zonesInRegion = current.filter((i) => i.region_id === regionIdNum && i.zone_id !== null).length;
      if (zonesInRegion >= MAX_ZONES_PER_REGION) {
        setAddError(t('interests.regionFull'));
        return;
      }
    }
    // Check broad + zones not allowed.
    if (zoneIdNum === null && current.some((i) => i.region_id === regionIdNum && i.zone_id !== null)) {
      setAddError(t('interests.broadWithZones'));
      return;
    }
    if (zoneIdNum !== null && current.some((i) => i.region_id === regionIdNum && i.zone_id === null)) {
      setAddError(t('interests.broadWithZones'));
      return;
    }

    const region = regionsData?.regions.find((r) => r.id === regionIdNum);
    const zone = options?.zones.find((z) => z.id === zoneIdNum);

    const newInterest: Interest = {
      region_id: regionIdNum,
      zone_id: zoneIdNum,
      region_name: region?.name_en,
      region_name_am: region?.name_am,
      zone_name: zone?.name_en,
      zone_name_am: zone?.name_am
    };
    setCurrent((prev) => [...prev, newInterest]);
    setAddRegionId('');
    setAddZoneId('');
    setOptions(null);
  };

  const handleRemove = (idx: number) => {
    setCurrent((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    try {
      await save.mutate({ interests: current });
      await refetchMy();
      setToast({ show: true, message: t('interests.interestsSaved') });
    } catch (err) {
      setToast({
        show: true,
        message: err instanceof Error ? err.message : t('common.error')
      });
    }
  };

  return (
    <Card>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-ink">{t('interests.title')}</h2>
        <p className="text-sm text-ink-muted">{t('interests.subtitle')}</p>
      </div>

      {/* Picker */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <Select
          value={addRegionId}
          onChange={(e) => setAddRegionId(e.target.value)}
          aria-label={t('profile.region')}
        >
          <option value="">{t('profile.selectOption')}</option>
          {regionsData?.regions.map((r) => (
            <option key={r.id} value={r.id}>
              {localizedField(r, 'name', lang)}
            </option>
          ))}
        </Select>
        <Select
          value={addZoneId}
          onChange={(e) => setAddZoneId(e.target.value)}
          disabled={!addRegionId || optionsLoading}
          aria-label={t('profile.zone')}
        >
          <option value="">{t('interests.zoneAny')}</option>
          {options?.zones.map((z) => (
            <option key={z.id} value={z.id}>
              {localizedField(z, 'name', lang)}
            </option>
          ))}
        </Select>
        <Button variant="secondary" size="md" leftIcon={<Plus size={14} />} onClick={handleAdd}>
          {t('interests.addInterest')}
        </Button>
      </div>
      {addError && <p className="mt-1.5 text-xs text-danger">{addError}</p>}

      {/* Selected list */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {t('interests.selectedInterests')}
          </h3>
          <Badge tone="gray">
            {distinctRegions.size} / {MAX_REGIONS}
          </Badge>
        </div>

        {current.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-4 text-center">
            <MapPin size={20} className="mx-auto text-ink-faint" />
            <p className="mt-1 text-sm text-ink-muted">{t('interests.noInterests')}</p>
            <p className="text-xs text-ink-faint">{t('interests.noInterestsHint')}</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {current.map((interest, idx) => {
              const regionName = lang === 'am' ? interest.region_name_am : interest.region_name;
              const zoneName = interest.zone_id === null
                ? t('interests.broadRegion')
                : (lang === 'am' ? interest.zone_name_am : interest.zone_name);
              return (
                <li
                  key={`${interest.region_id}-${interest.zone_id ?? 'null'}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-alt p-2.5"
                >
                  <div className="flex items-center gap-2 text-sm">
                    {interest.zone_id === null ? (
                      <Globe size={14} className="shrink-0 text-ink-faint" />
                    ) : (
                      <MapPin size={14} className="shrink-0 text-ink-faint" />
                    )}
                    <span className="font-medium text-ink">{regionName}</span>
                    <span className="text-ink-faint">·</span>
                    <span className="text-ink-muted">{zoneName}</span>
                  </div>
                  <button
                    onClick={() => handleRemove(idx)}
                    className="rounded p-1 text-ink-faint transition-colors hover:bg-red-50 hover:text-danger"
                    aria-label={t('common.remove')}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleSave}
        loading={save.loading}
        className="mt-4"
      >
        {t('common.save')}
      </Button>

      <Toast
        message={toast.message}
        show={toast.show}
        onDismiss={() => setToast({ show: false, message: '' })}
      />
    </Card>
  );
}
