import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array } from './push';

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url without padding', () => {
    // "hello" → aGVsbG8 (base64url, no padding)
    expect(Array.from(urlBase64ToUint8Array('aGVsbG8'))).toEqual([104, 101, 108, 108, 111]);
  });

  it('handles url-safe characters', () => {
    // 0xfb 0xff → "-_8" in base64url ("+/8" in base64)
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
  });
});
