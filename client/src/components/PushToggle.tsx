import { useEffect, useState } from 'react';
import { getPushConfig, sendTestPush } from '../api/push';
import { ApiError } from '../api/client';
import { useProfile } from '../hooks/useProfile';
import { getPushState, pushSupported, subscribePush, unsubscribePush } from '../lib/push';
import type { PushState } from '../lib/push';
import { useToast } from './Toast';

function isIosBrowserTab(): boolean {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

// "Benachrichtigungen: An/Aus" — per device and workspace. Hidden entirely
// when the server has no VAPID config or the browser cannot do push.
export function PushToggle() {
  const { profile } = useProfile();
  const { showError, showInfo } = useToast();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [state, setState] = useState<PushState | 'loading'>('loading');
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const cfg = await getPushConfig(controller.signal);
        if (cancelled) return;
        if (!cfg.enabled || !cfg.public_key) {
          setState('unsupported');
          return;
        }
        setPublicKey(cfg.public_key);
        setState(await getPushState());
      } catch {
        if (!cancelled) setState('unsupported');
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  if (!profile || state === 'loading' || state === 'unsupported') return null;

  // iOS Safari only exposes push inside an installed (home screen) app.
  // Say so instead of silently hiding the setting.
  if (!pushSupported()) {
    if (!isIosBrowserTab()) return null;
    return (
      <div>
        <p className="text-sm font-semibold text-stone-900">Benachrichtigungen</p>
        <p className="mt-1 text-xs text-stone-600">
          Auf dem iPhone gibt es Benachrichtigungen nur in der installierten App: In Safari unten
          auf <span className="font-medium">Teilen</span> tippen, dann{' '}
          <span className="font-medium">„Zum Home-Bildschirm“</span>. Danach hier einschalten.
        </p>
      </div>
    );
  }

  async function toggle(): Promise<void> {
    if (!publicKey || !profile) return;
    setBusy(true);
    try {
      const next =
        state === 'subscribed' ? await unsubscribePush() : await subscribePush(publicKey, profile.user_id);
      setState(next);
      if (next === 'denied') showError('Benachrichtigungen sind im Browser blockiert.');
      else showInfo(next === 'subscribed' ? 'Benachrichtigungen an.' : 'Benachrichtigungen aus.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Benachrichtigungen konnten nicht geändert werden.');
    } finally {
      setBusy(false);
    }
  }

  async function test(): Promise<void> {
    if (!profile) return;
    setBusy(true);
    try {
      await sendTestPush(profile.user_id);
      showInfo('Testnachricht gesendet.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Test fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const on = state === 'subscribed';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-900">Benachrichtigungen</p>
          <p className="text-xs text-stone-600">
            Neue Bestellung, Bestellschluss in 15 min, „bitte überweisen“, Zahlung bestätigt.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={busy || state === 'denied'}
          onClick={() => void toggle()}
          className={
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ' +
            (on ? 'bg-orange-500' : 'bg-stone-300')
          }
        >
          <span
            className={
              'inline-block h-5 w-5 rounded-full bg-white shadow transition ' +
              (on ? 'translate-x-5' : 'translate-x-0.5')
            }
          />
          <span className="sr-only">{on ? 'Benachrichtigungen aus' : 'Benachrichtigungen an'}</span>
        </button>
      </div>
      {state === 'denied' ? (
        <p className="help-xs">Im Browser blockiert – in den Seiteneinstellungen wieder erlauben.</p>
      ) : null}
      {isIosBrowserTab() ? (
        <p className="help-xs">
          Auf dem iPhone funktionieren Benachrichtigungen nur in der installierten App (Teilen → Zum
          Home-Bildschirm).
        </p>
      ) : null}
      {on ? (
        <button type="button" onClick={() => void test()} disabled={busy} className="btn-link text-xs">
          Testnachricht senden
        </button>
      ) : null}
    </div>
  );
}
