// ProfileForm — the profile edit form.
// Used both in ProfileGate (pre-completion) and ProfilePage (post-completion edits).

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Card, Button, Input, Select, Toast } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useApi } from '../../lib/hooks';
import { getGrades, getRegions, getZones, updateProfile } from '../../lib/api/endpoints';
import { useLang } from '../../lib/i18n';
import { localizedField } from '../../lib/i18n/localize';
import { createProfileFormState, validateProfileForm, type ProfileFormState, type ProfileFormErrors } from '../../lib/validation';
import { useMutation } from '../../lib/hooks';
import type { GradeRow, RegionsResponse, ZonesResponse, ProfileUpdateResponse } from '../../types';

interface ProfileFormProps {
  onSaved?: () => void;
}

export function ProfileForm({ onSaved }: ProfileFormProps) {
  const { me, refreshMe } = useAuth();
  const { t, lang } = useLang();
  const { data: gradesData } = useApi<GradeRow[]>('/api/v1/grades');
  const { data: regionsData } = useApi<RegionsResponse>('/api/v1/regions');
  const { data: zonesData } = useApi<ZonesResponse>(
    me?.region?.id ? `/api/v1/zones?region_id=${me.region.id}` : '/api/v1/zones',
    [me?.region?.id]
  );

  const [form, setForm] = useState<ProfileFormState>(() => createProfileFormState(me));
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Re-sync form when me changes (e.g. after a save).
  useEffect(() => {
    setForm(createProfileFormState(me));
  }, [me]);

  const save = useMutation<Record<string, unknown>, ProfileUpdateResponse>('PUT', '/api/v1/me');

  const handleChange = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegionChange = (value: string) => {
    setForm((prev) => ({ ...prev, region_id: value, zone_id: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateProfileForm(form, t);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    // Build payload — convert string IDs to numbers, omit empty strings.
    const payload: Record<string, unknown> = {};
    const fields: (keyof ProfileFormState)[] = [
      'full_name_en', 'full_name_am',
      'branch_name_en', 'branch_name_am',
      'neighborhood_en', 'neighborhood_am'
    ];
    for (const f of fields) {
      if (form[f]) payload[f] = form[f];
    }
    if (form.grade_id) payload.grade_id = Number(form.grade_id);
    if (form.region_id) payload.region_id = Number(form.region_id);
    if (form.zone_id) payload.zone_id = Number(form.zone_id);
    payload.preferred_language = form.preferred_language;

    try {
      await save.mutate(payload);
      await refreshMe();
      setToast({ show: true, message: t('profile.profileUpdated') });
      onSaved?.();
    } catch (err) {
      setToast({
        show: true,
        message: err instanceof Error ? err.message : t('common.error')
      });
    }
  };

  if (!me) return null;

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Bank (read-only) */}
        <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-3">
          <Building2 size={18} className="text-ink-faint" />
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">
              {t('profile.bank')}
            </p>
            <p className="text-sm font-medium text-ink">
              {localizedField(me.bank, 'name', lang)}
            </p>
          </div>
        </div>

        {/* Names */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('profile.fullNameEn')}
            value={form.full_name_en}
            onChange={(e) => handleChange('full_name_en', e.target.value)}
            error={errors.full_name_en}
            placeholder="Abebe Bekele"
          />
          <Input
            label={t('profile.fullNameAm')}
            value={form.full_name_am}
            onChange={(e) => handleChange('full_name_am', e.target.value)}
            error={errors.full_name_am}
            placeholder="አበበ በቀለ"
            dir="auto"
          />
        </div>

        {/* Branch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('profile.branchNameEn')}
            value={form.branch_name_en}
            onChange={(e) => handleChange('branch_name_en', e.target.value)}
            error={errors.branch_name_en}
            placeholder="Bole Branch"
          />
          <Input
            label={t('profile.branchNameAm')}
            value={form.branch_name_am}
            onChange={(e) => handleChange('branch_name_am', e.target.value)}
            error={errors.branch_name_am}
            placeholder="ቦሌ ቅርንጫፍ"
            dir="auto"
          />
        </div>

        {/* Neighborhood */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('profile.neighborhoodEn')}
            value={form.neighborhood_en}
            onChange={(e) => handleChange('neighborhood_en', e.target.value)}
            error={errors.neighborhood_en}
            placeholder="Bole"
          />
          <Input
            label={t('profile.neighborhoodAm')}
            value={form.neighborhood_am}
            onChange={(e) => handleChange('neighborhood_am', e.target.value)}
            error={errors.neighborhood_am}
            placeholder="ቦሌ"
            dir="auto"
          />
        </div>

        {/* Grade */}
        <Select
          label={t('profile.grade')}
          value={form.grade_id}
          onChange={(e) => handleChange('grade_id', e.target.value)}
          error={errors.grade_id ? String(errors.grade_id) : undefined}
        >
          <option value="">{t('profile.selectOption')}</option>
          {gradesData?.map((g) => (
            <option key={g.id} value={g.id}>
              {localizedField(g, 'tier_classification', lang)} — {localizedField(g, 'band_label', lang)}
            </option>
          ))}
        </Select>

        {/* Region + Zone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={t('profile.region')}
            value={form.region_id}
            onChange={(e) => handleRegionChange(e.target.value)}
            error={errors.region_id ? String(errors.region_id) : undefined}
          >
            <option value="">{t('profile.selectOption')}</option>
            {regionsData?.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {localizedField(r, 'name', lang)}
              </option>
            ))}
          </Select>

          <Select
            label={t('profile.zone')}
            value={form.zone_id}
            onChange={(e) => handleChange('zone_id', e.target.value)}
            error={errors.zone_id ? String(errors.zone_id) : undefined}
            disabled={!form.region_id}
          >
            <option value="">{t('profile.selectOption')}</option>
            {zonesData?.zones
              .filter((z) => !form.region_id || z.region_id === Number(form.region_id))
              .map((z) => (
                <option key={z.id} value={z.id}>
                  {localizedField(z, 'name', lang)}
                </option>
              ))}
          </Select>
        </div>

        {/* Language */}
        <Select
          label={t('profile.language')}
          value={form.preferred_language}
          onChange={(e) => handleChange('preferred_language', e.target.value as 'en' | 'am')}
        >
          <option value="en">English</option>
          <option value="am">አማርኛ</option>
        </Select>

        <Button type="submit" variant="primary" size="lg" fullWidth loading={save.loading}>
          {t('common.save')}
        </Button>
      </form>

      <Toast
        message={toast.message}
        show={toast.show}
        onDismiss={() => setToast({ show: false, message: '' })}
      />
    </Card>
  );
}
