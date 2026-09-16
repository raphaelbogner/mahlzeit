import { deletePushSubscription, savePushSubscription } from '../api/push';

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// VAPID public key (base64url) → the ApplicationServerKey bytes.
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const READY_TIMEOUT_MS = 4000;

// The app's service worker registration. Looked up by its scope (not the
// page URL) and, when it is still installing on a cold start, awaited via
// `ready` for a bounded time. Returning null too eagerly made the toggle
// read "off" although the browser still held a live subscription.
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const scope = import.meta.env.BASE_URL;
  const direct =
    (await navigator.serviceWorker.getRegistration(scope)) ??
    (await navigator.serviceWorker.getRegistration());
  if (direct) return direct;
  return new Promise<ServiceWorkerRegistration | null>((resolve) => {
    const timer = window.setTimeout(() => resolve(null), READY_TIMEOUT_MS);
    navigator.serviceWorker.ready.then(
      (reg) => {
        window.clearTimeout(timer);
        resolve(reg);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsubscribed';
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'subscribed' : 'unsubscribed';
}

// Re-send the browser's current subscription to the server. The server drops
// rows after repeated delivery failures or a 404/410 from the push service,
// and the browser has no way of knowing — so the switch would show "on"
// while nothing arrives. Called whenever the toggle finds an active
// subscription. Returns false when there is nothing to sync.
export async function syncPushSubscription(userId: string): Promise<boolean> {
  const reg = await registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return false;
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
  await savePushSubscription({
    user_id: userId,
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    user_agent: navigator.userAgent,
  });
  return true;
}

export async function subscribePush(publicKey: string, userId: string): Promise<PushState> {
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'unsubscribed';
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('Push subscription incomplete');
  }
  await savePushSubscription({
    user_id: userId,
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    user_agent: navigator.userAgent,
  });
  return 'subscribed';
}

export async function unsubscribePush(): Promise<PushState> {
  const reg = await registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    try {
      await deletePushSubscription(sub.endpoint);
    } finally {
      await sub.unsubscribe();
    }
  }
  return 'unsubscribed';
}
