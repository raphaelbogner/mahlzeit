import { useEffect, useState } from 'react';
import { BackupPanel } from './BackupPanel';
import { PushToggle } from './PushToggle';

const DISMISS_KEY = 'mahlzeit.hints.firstorder.v1';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// One-time checklist after the user's first order: secure the profile and
// install the app. Dismissable; remembered per browser.
export function FirstOrderHints() {
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(isStandalone);

  useEffect(() => {
    function onPrompt(e: Event): void {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled(): void {
      setInstalled(true);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (dismissed) return null;

  function dismiss(): void {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // per-browser convenience only
    }
  }

  async function install(): Promise<void> {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  }

  return (
    <section className="card-pad space-y-5 ring-orange-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="h-section">Kurz einrichten</h3>
          <p className="mt-1 help-xs">Zwei Dinge, die dir später Ärger sparen.</p>
        </div>
        <button type="button" onClick={dismiss} className="btn-ghost btn-sm" aria-label="Hinweise ausblenden">
          ✕
        </button>
      </div>

      <BackupPanel compact />

      <div className="border-t border-stone-200 pt-4">
        <PushToggle />
      </div>

      {!installed ? (
        <div className="border-t border-stone-200 pt-4">
          <p className="text-sm font-semibold text-stone-900">Als App installieren</p>
          {installEvent ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void install()} className="btn-secondary btn-sm">
                Zum Startbildschirm hinzufügen
              </button>
              <span className="help-xs">Schneller Start, eigenes Fenster, später Benachrichtigungen.</span>
            </div>
          ) : isIos() ? (
            <p className="mt-1 text-xs text-stone-600">
              In Safari unten auf <span className="font-medium">Teilen</span> tippen und{' '}
              <span className="font-medium">„Zum Home-Bildschirm“</span> wählen. Als installierte App
              behält Safari dein Profil dauerhaft.
            </p>
          ) : (
            <p className="mt-1 text-xs text-stone-600">
              Im Browser-Menü <span className="font-medium">„App installieren“</span> bzw. „Zum
              Startbildschirm hinzufügen“ wählen.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
