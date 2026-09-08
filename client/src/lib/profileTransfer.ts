import type { Profile } from '../hooks/useProfile';
import { cleanIban, isValidIban } from './iban';

// The profile travels in the URL *fragment* so it never reaches the server
// (fragments are not sent in requests and do not show up in access logs).
export const PROFILE_HASH_KEY = 'profile';

interface TransferPayload {
  v: 1;
  user_id: string;
  user_name: string;
  iban: string;
}

const ID_RE = /^[0-9a-z]{16}$/;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string | null {
  try {
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeProfileLink(profile: Profile, token: string, origin: string): string {
  const payload: TransferPayload = {
    v: 1,
    user_id: profile.user_id,
    user_name: profile.user_name,
    iban: profile.iban,
  };
  return `${origin}/w/?w=${encodeURIComponent(token)}#${PROFILE_HASH_KEY}=${toBase64Url(JSON.stringify(payload))}`;
}

// Parse `location.hash`. Returns null for anything that is not a valid
// version-1 payload (bad id, too long name, invalid IBAN).
export function decodeProfileHash(hash: string): Profile | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const data = params.get(PROFILE_HASH_KEY);
  if (!data) return null;
  const json = fromBase64Url(data);
  if (json === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const p = parsed as Partial<TransferPayload>;
  if (p.v !== 1) return null;
  if (typeof p.user_id !== 'string' || !ID_RE.test(p.user_id)) return null;
  if (typeof p.user_name !== 'string') return null;
  const name = p.user_name.trim();
  if (name.length === 0 || name.length > 120) return null;
  const iban = typeof p.iban === 'string' ? cleanIban(p.iban) : '';
  if (iban !== '' && !isValidIban(iban)) return null;
  return { user_id: p.user_id, user_name: name, iban };
}

export function sameProfile(a: Profile, b: Profile): boolean {
  return a.user_id === b.user_id && a.user_name === b.user_name && a.iban === b.iban;
}
