// Profile edit form. Used inside the ProfileGate (pre-completion) and
// inside the ProfilePage (post-completion, for edits).
//
// Bank is intentionally NOT editable — backend rejects bank_id changes
// (user.service.js → updateProfile) and the SRS treats bank as fixed at
// registration. We show it as read-only context instead.

import { useEffect, useState } from 'react';
import { getGrades, getInterestOptions } from '../../api';
import { useAuth } from '../../auth';
import { useLang, type TranslationKey } from '../../i18n';
import { useMutation } from '../../hooks';
import { Button, Input, Select } from '../../ui';
import {
  createProfileFormState,
  validateProfileForm,
  type ProfileFormState
} from '../../validation';
import { SEEDED_REGIONS } from '../../regions';
import type { GradeRow, InterestOptionsResponse, Lang, MeUser } from '../../types';

// Need a grades/regions/zones source. The interests/options endpoint gives us
// region + zones for a single region. For grades, we'd need a separate
// endpoint — but there isn't a public GET /grades. We get grades indirectly
// from the user's own profile (me.grade) and from the marketplace cards.
//
// Pragmatic approach: render grade as a free-text field that accepts the
// grade number (1..18). The backend's updateProfileSchema accepts grade_id
// as a positive integer; we resolve the grade_id from a small lookup table
// the user can edit. For now, since we don't have a grades list endpoint,
// we'll show grade_id directly as a number input with a hint.
//
// Better approach: derive grades from the user's own grade (if set), and
// let the user pick from a numeric dropdown 1..18. The label shows the band.

export function ProfileForm({ onSaved }: { onSaved: () => Promise<unknown> }) {
  const { me } = useAuth();
  const { t, lang } = useLang();

  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [gradesLoading, setGradesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setGradesLoading(true);
    getGrades()
      .then(data => {
        if (!cancelled) setGrades(data);
      })
      .catch(() => {
        if (!cancelled) setGrades([]);
      })
      .finally(() => {
        if (!cancelled) setGradesLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const [form, setForm] = useState<ProfileFormState>(() =>
    createProfileFormState(me)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Region picker needs zone options. We use the interests/options endpoint
  // which returns zones for a single region — same as the InterestsManager.
  // We pass region_id explicitly so the backend returns zones for the
  // selected region, not the user's home region.
  const [regionOptions, setRegionOptions] = useState<InterestOptionsResponse | null>(null);
  const [regionOptionsLoading, setRegionOptionsLoading] = useState(false);

  // Load zones whenever the selected region changes.
  useEffect(() => {
    if (!form.region_id) {
      setRegionOptions(null);
      return;
    }

    let cancelled = false;
    setRegionOptionsLoading(true);
    getInterestOptions(Number(form.region_id))
      .then(data => {
        if (!cancelled) setRegionOptions(data);
      })
      .catch(() => {
        if (!cancelled) setRegionOptions(null);
      })
      .finally(() => {
        if (!cancelled) setRegionOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.region_id]);

  // Format a grade row for dropdown display.
  function gradeOptionLabel(g: GradeRow): string {
    const tier = lang === 'am'
      ? (g.tier_classification_am || g.tier_classification_en)
      : (g.tier_classification_en || g.tier_classification_am);
    const band = lang === 'am'
      ? (g.band_label_am || g.band_label_en)
      : (g.band_label_en || g.band_label_am);
    return `${tier} · ${band}`;
  }

  // Sync form when me loads/refreshes.
  useEffect(() => {
    setForm(createProfileFormState(me));
  }, [me]);

  // Save mutation — calls PUT /api/v1/me.
  const save = useMutation<Record<string, unknown>, { updated: boolean; profile_complete: boolean }>(
    'PUT',
    '/api/v1/me'
  );

  function update<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaveError(null);
    setSaved(false);

    const nextErrors = validateProfileForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      // Build payload — convert string IDs to numbers, drop empties.
      const payload: Record<string, unknown> = {
        full_name_en: form.full_name_en.trim() || null,
        full_name_am: form.full_name_am.trim() || null,
        branch_name_en: form.branch_name_en.trim() || null,
        branch_name_am: form.branch_name_am.trim() || null,
        neighborhood_en: form.neighborhood_en.trim() || null,
        neighborhood_am: form.neighborhood_am.trim() || null,
        grade_id: form.grade_id ? Number(form.grade_id) : null,
        region_id: Number(form.region_id),
        zone_id: Number(form.zone_id),
        preferred_language: form.preferred_language
      };

      await save.mutate(payload);
      await onSaved();
      setSaved(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('error');
      setSaveError(message);
    }
  }

  // Read-only bank display — bank is fixed at registration.
  function renderBankRow() {
    if (!me?.bank) return null;
    const bankLabel = me.bank.name || me.bank.nickname || `Bank #${me.bank.id}`;
    return (
      <div className="mb-4">
        <span className="mb-1.5 block text-sm font-medium text-ink">{t('bank')}</span>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-3.5 py-2.5 text-sm text-ink-muted">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span>{bankLabel}</span>
          <span className="ml-auto text-2xs uppercase tracking-wide text-ink-faint">
            {t('bank')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      {saveError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      ) : null}

      {/* Name */}
      <Input
        label={t('fullNameEn')}
        value={form.full_name_en}
        onChange={e => update('full_name_en', e.target.value)}
        error={
          errors.full_name ? t(errors.full_name as TranslationKey) : undefined
        }
      />
      <Input
        label={t('fullNameAm')}
        value={form.full_name_am}
        onChange={e => update('full_name_am', e.target.value)}
      />

      {/* Branch */}
      <Input
        label={t('branchNameEn')}
        value={form.branch_name_en}
        onChange={e => update('branch_name_en', e.target.value)}
        error={
          errors.branch_name
            ? t(errors.branch_name as TranslationKey)
            : errors.branch_name_en
              ? t(errors.branch_name_en as TranslationKey)
              : undefined
        }
      />
      <Input
        label={t('branchNameAm')}
        value={form.branch_name_am}
        onChange={e => update('branch_name_am', e.target.value)}
        error={
          errors.branch_name_am
            ? t(errors.branch_name_am as TranslationKey)
            : undefined
        }
      />

      {/* Neighborhood */}
      <Input
        label={t('neighborhoodEn')}
        value={form.neighborhood_en}
        onChange={e => update('neighborhood_en', e.target.value)}
        error={
          errors.neighborhood
            ? t(errors.neighborhood as TranslationKey)
            : errors.neighborhood_en
              ? t(errors.neighborhood_en as TranslationKey)
              : undefined
        }
      />
      <Input
        label={t('neighborhoodAm')}
        value={form.neighborhood_am}
        onChange={e => update('neighborhood_am', e.target.value)}
        error={
          errors.neighborhood_am
            ? t(errors.neighborhood_am as TranslationKey)
            : undefined
        }
      />

      {/* Bank — read-only */}
      {renderBankRow()}

      {/* Grade — fetched from backend */}
      <Select
        label={t('grade')}
        value={form.grade_id}
        onChange={e => update('grade_id', e.target.value)}
        error={errors.grade_id ? t(errors.grade_id as TranslationKey) : undefined}
        disabled={gradesLoading}
      >
        <option value="">{t('selectOption')}</option>
        {grades.map(g => (
          <option key={g.id} value={g.id}>
            {gradeOptionLabel(g)}
          </option>
        ))}
      </Select>

      {/* Region — full list pulled from interests/options endpoint */}
      <RegionSelect
        value={form.region_id}
        onChange={value => {
          update('region_id', value);
          update('zone_id', '');
        }}
        error={errors.region_id ? t(errors.region_id as TranslationKey) : undefined}
      />

      {/* Zone — pulled from the selected region's options */}
      <Select
        label={t('zone')}
        value={form.zone_id}
        onChange={e => update('zone_id', e.target.value)}
        error={errors.zone_id ? t(errors.zone_id as TranslationKey) : undefined}
        disabled={!form.region_id || regionOptionsLoading}
      >
        <option value="">{t('selectOption')}</option>
        {regionOptions?.zones.map(zone => (
          <option key={zone.id} value={zone.id}>
            {zone.name} / {zone.name_am}
          </option>
        ))}
      </Select>

      {/* Preferred language */}
      <Select
        label={t('language')}
        value={form.preferred_language}
        onChange={e => update('preferred_language', e.target.value as Lang)}
      >
        <option value="en">English</option>
        <option value="am">አማርኛ</option>
      </Select>

      <Button type="submit" fullWidth size="lg" loading={save.loading}>
        {t('save')}
      </Button>

      {saved ? (
        <p className="mt-3 text-center text-sm text-brand-dark">{t('profileUpdated')}</p>
      ) : null}
    </form>
  );
}

// ─── Region select ─────────────────────────────────────────────────────────
// Pulls all regions by calling /interests/options with no region_id (backend
// returns the user's home region in that case), but we actually want ALL
// regions. Since there's no public GET /regions endpoint, we fall back to a
// known list derived from seeds.md.

function RegionSelect({
  value,
  onChange,
  error
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { t } = useLang();

  return (
    <Select
      label={t('region')}
      value={value}
      onChange={e => onChange(e.target.value)}
      error={error}
    >
      <option value="">{t('selectOption')}</option>
      {SEEDED_REGIONS.map(r => (
        <option key={r.id} value={r.id}>
          {r.name} / {r.name_am}
        </option>
      ))}
    </Select>
  );
}

// Convenience export so ProfilePage can show the same bank row elsewhere.
export function BankRow({ me }: { me: MeUser | null }) {
  if (!me?.bank) return null;
  const bankLabel = me.bank.name || me.bank.nickname || `Bank #${me.bank.id}`;
  return (
    <div className="flex items-center gap-2 text-sm text-ink-muted">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
      <span>{bankLabel}</span>
    </div>
  );
}
