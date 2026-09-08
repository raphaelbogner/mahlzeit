import { describe, it, expect } from 'vitest';
import { decodeProfileHash, encodeProfileLink, sameProfile } from './profileTransfer';

const profile = { user_id: 'abcdef0123456789', user_name: 'Raphael Ö', iban: 'AT611904300234573201' };

describe('profileTransfer', () => {
  it('round-trips a profile through the URL fragment', () => {
    const url = encodeProfileLink(profile, 'tok/en', 'https://m.example');
    expect(url.startsWith('https://m.example/w/?w=tok%2Fen#profile=')).toBe(true);
    const hash = url.slice(url.indexOf('#'));
    expect(decodeProfileHash(hash)).toEqual(profile);
  });

  it('accepts an empty IBAN and trims the name', () => {
    const url = encodeProfileLink({ ...profile, iban: '', user_name: '  Anna ' }, 't', 'https://x');
    expect(decodeProfileHash(url.slice(url.indexOf('#')))).toEqual({
      user_id: profile.user_id,
      user_name: 'Anna',
      iban: '',
    });
  });

  it('rejects garbage, wrong versions, bad ids and invalid IBANs', () => {
    expect(decodeProfileHash('')).toBeNull();
    expect(decodeProfileHash('#profile=not-base64!!')).toBeNull();
    expect(decodeProfileHash('#other=1')).toBeNull();
    const bad = (obj: unknown) => `#profile=${btoa(JSON.stringify(obj)).replace(/=+$/, '')}`;
    expect(decodeProfileHash(bad({ v: 2, user_id: profile.user_id, user_name: 'A', iban: '' }))).toBeNull();
    expect(decodeProfileHash(bad({ v: 1, user_id: 'SHORT', user_name: 'A', iban: '' }))).toBeNull();
    expect(decodeProfileHash(bad({ v: 1, user_id: profile.user_id, user_name: '', iban: '' }))).toBeNull();
    expect(
      decodeProfileHash(bad({ v: 1, user_id: profile.user_id, user_name: 'A', iban: 'AT00INVALID' })),
    ).toBeNull();
  });

  it('compares profiles field by field', () => {
    expect(sameProfile(profile, { ...profile })).toBe(true);
    expect(sameProfile(profile, { ...profile, user_name: 'X' })).toBe(false);
  });
});
