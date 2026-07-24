// ProfilePage — the profile tab.
// Sections: header summary, completeness card, photo uploader, profile form,
// interests manager, sign-out.

import { useRef, useState } from 'react';
import { LogOut, Camera, Trash2, User } from 'lucide-react';
import { Card, Button, Modal, Toast } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useConfig } from '../../lib/hooks';
import { useLang } from '../../lib/i18n';
import { uploadPhoto, deletePhoto, resolveAssetUrl } from '../../lib/api/endpoints';
import { localizedField } from '../../lib/i18n/localize';
import { isValidPhoto } from '../../lib/validation';
import { getInitials } from '../../lib/utils';
import { CompletenessCard } from './CompletenessCard';
import { ProfileForm } from './ProfileForm';
import { InterestsManager } from '../interests/InterestsManager';
import type { TranslationKey } from '../../lib/i18n';

export function ProfilePage() {
  const { me, signOut, refreshMe } = useAuth();
  const { config } = useConfig();
  const { t, lang } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  if (!me) return null;

  const photoSrc = me.photo_url ? resolveAssetUrl(me.photo_url, config.photo_base_url) : null;
  const displayName = localizedField(me, 'full_name', lang) ||
    localizedField(me, 'full_name', 'en') ||
    me.telegram_username ||
    t('profile.title');
  const bankName = me.bank ? localizedField(me.bank, 'name', lang) : '';
  const isCustom = me.photo_source === 'custom';
  const initials = getInitials(me.full_name_en || me.full_name_am || '');

  const showToast = (key: TranslationKey) => {
    setToast({ show: true, message: t(key) });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const valid = isValidPhoto(file);
    if (valid !== true) {
      setToast({ show: true, message: t(valid) });
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await uploadPhoto(formData);
      await refreshMe();
      showToast('profile.photoUpdated');
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deletePhoto();
      await refreshMe();
      showToast('profile.photoDeleted');
    } catch (err) {
      setToast({ show: true, message: err instanceof Error ? err.message : t('common.error') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      {/* Profile card with photo + upload */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {photoSrc ? (
              <img
                src={photoSrc}
                alt={displayName}
                className="h-20 w-20 rounded-2xl object-cover ring-1 ring-line"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-muted text-xl font-semibold text-ink-muted ring-1 ring-line">
                {initials || <User size={28} />}
              </div>
            )}
            <div className="flex-1 space-y-0.5 min-w-0">
              <h2 className="truncate text-base font-semibold text-ink">{displayName}</h2>
              {me.grade && (
                <p className="text-xs text-ink-muted">
                  {localizedField(me.grade, 'tier_classification', lang)}
                </p>
              )}
              {bankName && <p className="truncate text-xs text-ink-muted">{bankName}</p>}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Camera size={14} />}
              onClick={() => fileRef.current?.click()}
              loading={busy}
            >
              {isCustom ? t('profile.changePhoto') : t('profile.uploadPhoto')}
            </Button>
            {isCustom && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                onClick={handleDelete}
                disabled={busy}
                className="text-danger hover:bg-red-50"
              >
                {t('profile.deletePhoto')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Completeness */}
      <CompletenessCard />

      {/* Profile form */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-ink">{t('profile.title')}</h3>
        <ProfileForm />
      </div>

      {/* Interests manager */}
      <div className="space-y-2">
        <InterestsManager />
      </div>

      {/* Sign out */}
      <Button
        variant="ghost"
        size="md"
        fullWidth
        leftIcon={<LogOut size={14} />}
        onClick={() => setConfirmSignOut(true)}
        className="text-danger hover:bg-red-50"
      >
        {t('profile.signOut')}
      </Button>

      {/* Sign out confirm modal */}
      <Modal
        open={confirmSignOut}
        title={t('profile.signOut')}
        onClose={() => setConfirmSignOut(false)}
        variant="center"
      >
        <div className="p-4 space-y-4">
          <p className="text-sm text-ink-muted">{t('profile.signOutConfirm')}</p>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmSignOut(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                setConfirmSignOut(false);
                signOut();
              }}
            >
              {t('profile.signOut')}
            </Button>
          </div>
        </div>
      </Modal>

      <Toast
        message={toast.message}
        show={toast.show}
        onDismiss={() => setToast({ show: false, message: '' })}
      />
    </div>
  );
}
