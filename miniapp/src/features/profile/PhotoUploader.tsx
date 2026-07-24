// PhotoUploader — profile photo upload/delete card.
// Extracted from ProfilePage for clarity.

import { useRef, useState } from 'react';
import { Camera, Trash2, User } from 'lucide-react';
import { Card, Button, Toast } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { useConfig } from '../../lib/hooks';
import { uploadPhoto, deletePhoto, resolveAssetUrl } from '../../lib/api/endpoints';
import { isValidPhoto } from '../../lib/validation';
import { useLang } from '../../lib/i18n';
import { getInitials } from '../../lib/utils';
import type { TranslationKey } from '../../lib/i18n';

export function PhotoUploader() {
  const { me, refreshMe } = useAuth();
  const { config } = useConfig();
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  if (!me) return null;

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

  const photoSrc = me.photo_url ? resolveAssetUrl(me.photo_url, config.photo_base_url) : null;
  const initials = getInitials(me.full_name_en || me.full_name_am || '');
  const isCustom = me.photo_source === 'custom';

  return (
    <Card>
      <div className="flex items-center gap-4">
        {/* Photo */}
        {photoSrc ? (
          <img
            src={photoSrc}
            alt="Profile"
            className="h-20 w-20 rounded-2xl object-cover ring-1 ring-line"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-muted text-xl font-semibold text-ink-muted ring-1 ring-line">
            {initials || <User size={28} />}
          </div>
        )}

        <div className="flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Camera size={14} />}
            onClick={() => fileRef.current?.click()}
            loading={busy}
            fullWidth
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
              fullWidth
              className="text-danger hover:bg-red-50"
            >
              {t('profile.deletePhoto')}
            </Button>
          )}
        </div>
      </div>

      <Toast
        message={toast.message}
        show={toast.show}
        onDismiss={() => setToast({ show: false, message: '' })}
      />
    </Card>
  );
}
