import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { cleanIban, formatIban, isValidIban } from '../lib/iban';
import { useProfile } from '../hooks/useProfile';
import { useToast } from './Toast';

export function ProfileMenu() {
  const { profile, updateProfile } = useProfile();
  const [open, setOpen] = useState<boolean>(false);

  if (!profile) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-200"
        aria-haspopup="dialog"
        aria-label={`Profil bearbeiten (${profile.user_name})`}
        title="Profil bearbeiten"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" aria-hidden="true" />
        <span className="max-w-[10rem] truncate">{profile.user_name}</span>
      </button>
      {open ? (
        <EditProfileDialog
          initialName={profile.user_name}
          initialIban={profile.iban}
          onSave={(patch) => {
            updateProfile(patch);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

interface EditProfileDialogProps {
  initialName: string;
  initialIban: string;
  onSave: (patch: { user_name: string; iban: string }) => void;
  onClose: () => void;
}

function EditProfileDialog({
  initialName,
  initialIban,
  onSave,
  onClose,
}: EditProfileDialogProps) {
  const [name, setName] = useState<string>(initialName);
  const [iban, setIban] = useState<string>(initialIban ? formatIban(initialIban) : '');
  const [errors, setErrors] = useState<{ name?: string; iban?: string }>({});
  const { showInfo } = useToast();

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock body scroll while the modal is mounted so the page behind doesn't
  // shift around when the dialog is taller than the viewport.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmedName = name.trim();
    const cleanedIban = cleanIban(iban);
    const next: { name?: string; iban?: string } = {};
    if (trimmedName.length === 0) {
      next.name = 'Bitte einen Namen eingeben.';
    } else if (trimmedName.length > 120) {
      next.name = 'Name ist zu lang (max. 120 Zeichen).';
    }
    if (cleanedIban.length > 0 && !isValidIban(cleanedIban)) {
      next.iban = 'Diese IBAN ist ungültig.';
    }
    if (next.name || next.iban) {
      setErrors(next);
      return;
    }
    setErrors({});
    onSave({ user_name: trimmedName, iban: cleanedIban });
    showInfo('Profil aktualisiert.');
  }

  // Render through a portal so the modal escapes any ancestor with
  // `backdrop-filter` / `transform` / `filter`, which would otherwise become
  // the containing block for `position: fixed` and clip the modal.
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-dialog-title"
    >
      <div
        className="flex min-h-full items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <form
          onSubmit={handleSubmit}
          className="card w-full max-w-md p-6 shadow-pop animate-fade-in-up"
          noValidate
        >
        <h2 id="profile-dialog-title" className="text-lg font-semibold text-stone-900">
          Profil bearbeiten
        </h2>
        <p className="mt-1 help-xs">
          Änderungen gelten für neue Einträge. Bereits abgegebene Bestellungen behalten den
          ursprünglichen Namen.
        </p>

        <div className="mt-5">
          <label htmlFor="profile-name" className="label">
            Name
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoFocus
            autoComplete="name"
            className="input"
            aria-invalid={errors.name ? 'true' : 'false'}
          />
          {errors.name && (
            <p className="field-error" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="profile-iban" className="label">
            IBAN <span className="font-normal text-stone-400">(optional)</span>
          </label>
          <input
            id="profile-iban"
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            onBlur={(e) => setIban(formatIban(e.target.value))}
            placeholder="AT61 1904 3002 3457 3201"
            maxLength={42}
            autoComplete="off"
            spellCheck={false}
            className="input-mono"
            aria-invalid={errors.iban ? 'true' : 'false'}
          />
          {errors.iban && (
            <p className="field-error" role="alert">
              {errors.iban}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Abbrechen
          </button>
          <button type="submit" className="btn-primary">
            Speichern
          </button>
        </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
