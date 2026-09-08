import { createPortal } from 'react-dom';
import type { Profile } from '../hooks/useProfile';

export interface ImportProfileDialogProps {
  current: Profile;
  incoming: Profile;
  onReplace: () => void;
  onKeep: () => void;
}

// Shown when a restore link is opened on a device that already has a profile.
export function ImportProfileDialog({ current, incoming, onReplace, onKeep }: ImportProfileDialogProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-profile-title"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="card w-full max-w-md p-6 shadow-pop animate-fade-in-up">
          <h2 id="import-profile-title" className="text-lg font-semibold text-stone-900">
            Profil übernehmen?
          </h2>
          <p className="mt-2 text-sm text-stone-700">
            Auf diesem Gerät bist du <span className="font-medium">„{current.user_name}“</span>. Der
            geöffnete Link gehört zu <span className="font-medium">„{incoming.user_name}“</span>.
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Beim Ersetzen werden Name, IBAN und Kennung übernommen. Deine bisherigen Einträge bleiben
            in den Bestellungen, gelten aber nicht mehr als deine.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onKeep} className="btn-secondary">
              Behalten
            </button>
            <button type="button" onClick={onReplace} className="btn-primary">
              Ersetzen
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
