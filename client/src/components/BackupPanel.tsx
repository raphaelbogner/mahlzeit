import { useState } from 'react';
import { getWorkspaceToken } from '../api/client';
import { useProfile } from '../hooks/useProfile';
import { encodeProfileLink } from '../lib/profileTransfer';
import { copyText } from '../lib/share';
import { QrCode } from './QrCode';
import { useToast } from './Toast';

export interface BackupPanelProps {
  compact?: boolean;
}

// "Gerät verbinden / Backup": QR + link that restores this exact profile
// (user_id, name, IBAN) on another device or after clearing browser data.
export function BackupPanel({ compact }: BackupPanelProps) {
  const { profile } = useProfile();
  const { showError, showInfo } = useToast();
  const [showQr, setShowQr] = useState<boolean>(!compact);

  if (!profile) return null;
  const link = encodeProfileLink(profile, getWorkspaceToken() ?? '', window.location.origin);

  async function handleCopy(): Promise<void> {
    const ok = await copyText(link, navigator, document);
    if (ok) showInfo('Wiederherstellungs-Link kopiert.');
    else showError('Kopieren fehlgeschlagen.');
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-stone-900">Gerät verbinden / Backup</p>
        <p className="mt-1 text-xs text-stone-600">
          Dein Profil liegt nur in diesem Browser. Mit diesem Link stellst du es auf einem anderen
          Gerät oder nach dem Löschen der Browserdaten wieder her – gleiche Person, gleiche
          Bestellhistorie.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        {showQr ? (
          <QrCode value={link} label="QR-Code zum Übertragen deines Profils" size={160} />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void handleCopy()} className="btn-secondary btn-sm">
              Link kopieren
            </button>
            {compact && !showQr ? (
              <button type="button" onClick={() => setShowQr(true)} className="btn-secondary btn-sm">
                QR anzeigen
              </button>
            ) : null}
          </div>
          <p className="help-xs">
            Am anderen Gerät QR scannen oder Link öffnen. Der Link enthält Name und IBAN – nur an
            dich selbst schicken.
          </p>
        </div>
      </div>
    </div>
  );
}
