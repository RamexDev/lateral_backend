// Profile tab.
// Sections: completeness card, photo card, profile edit form, interests
// manager, sign-out.

import { useState } from 'react';
import { deletePhoto, uploadPhoto } from '../../api';
import { useAuth } from '../../auth';
import { useApi } from '../../hooks';
import { useLang, type TranslationKey } from '../../i18n';
import { resolveAssetUrl } from '../../api';
import { Button, Card, Spinner, Toast } from '../../ui';
import { isValidPhoto } from '../../utils';
import type { Completeness } from '../../types';
import { BankRow, ProfileForm } from './ProfileForm';
import { InterestsManager } from '../interests/InterestsManager';
import { CompletenessCard, CompletenessCardSkeleton } from './CompletenessCard';

export function ProfilePage() {
  const { me, refreshMe, signOut } = useAuth();
  const { t, lang } = useLang();

  const [toast, setToast] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  // Fetch completeness — drives the nudge card.
  const completeness = useApi<Completeness>('/api/v1/me/completeness');

  if (!me) {
    return <Spinner full />;
  }

  // Photo URL — resolve relative paths to full backend URL.
  const photoUrl = resolveAssetUrl(me.photo_url);

  // Upload a new photo.
  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    // Client-side validation matches backend multer config.
    const validationError = isValidPhoto(file);
    if (validationError) {
      setPhotoError(t(validationError as TranslationKey));
      return;
    }

    setPhotoBusy(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await uploadPhoto(formData);
      await refreshMe();
      setToast(t('photoUpdated'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('error');
      setPhotoError(message);
    } finally {
      setPhotoBusy(false);
      // Reset the input so the same file can be re-selected.
      event.target.value = '';
    }
  }

  // Delete the custom photo (reverts to Telegram photo or placeholder).
  async function onDeletePhoto() {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      await deletePhoto();
      await refreshMe();
      setToast(t('photoDeleted'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('error');
      setPhotoError(message);
    } finally {
      setPhotoBusy(false);
    }
  }

  // Sign out — confirm first to avoid accidental logouts.
  function onSignOut() {
    if (window.confirm(t('signOutConfirm'))) {
      signOut();
    }
  }

  return (
    <div className="tab-enter mx-auto max-w-lg space-y-4 p-4">
      {/* Header summary — name + bank */}
      <Card className="flex items-center gap-4">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="h-16 w-16 rounded-2xl object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-light text-base font-semibold text-brand-dark">
            {(me.full_name_en || me.full_name_am || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold text-ink">
            {me.full_name_en || me.full_name_am || t('completeProfile')}
          </h2>
          <div className="mt-1">
            <BankRow me={me} />
          </div>
        </div>
      </Card>

      {/* Completeness nudge card */}
      {completeness.data ? (
        <CompletenessCard completeness={completeness.data} />
      ) : completeness.loading ? (
        <CompletenessCardSkeleton />
      ) : null}

      {/* Photo card */}
      <Card>
        <h3 className="mb-3 text-base font-semibold text-ink">{t('photo')}</h3>
        <div className="flex items-center gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              className="h-20 w-20 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-muted text-sm text-ink-faint">
              {t('photo')}
            </div>
          )}

          <div className="flex-1 space-y-2">
            <label className="inline-block">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFileChange}
                className="hidden"
              />
              <span className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-muted">
                {photoUrl ? t('changePhoto') : t('uploadPhoto')}
              </span>
            </label>

            {me.photo_url && me.photo_source === 'custom' ? (
              <div>
                <Button
                  variant="danger"
                  size="sm"
                  loading={photoBusy}
                  onClick={onDeletePhoto}
                >
                  {t('deletePhoto')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        {photoError ? (
          <p className="mt-3 text-sm text-danger">{photoError}</p>
        ) : null}
      </Card>

      {/* Profile edit form */}
      <Card>
        <h3 className="mb-3 text-base font-semibold text-ink">{t('profile')}</h3>
        <ProfileForm
          onSaved={async () => {
            await refreshMe();
            await completeness.refetch();
            setToast(t('profileUpdated'));
          }}
        />
      </Card>

      {/* Interests manager */}
      <InterestsManager />

      {/* Sign out */}
      <Button variant="secondary" fullWidth size="lg" onClick={onSignOut}>
        {t('signOut')}
      </Button>

      <Toast
        message={toast ?? ''}
        show={toast !== null}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}


