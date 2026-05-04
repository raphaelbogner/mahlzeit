import { describe, it, expect } from 'vitest';
import { cleanIban, formatIban, isValidIban } from './iban';

describe('cleanIban', () => {
  it('strips spaces and uppercases', () => {
    expect(cleanIban('  at61 1904 3002 3457 3201 ')).toBe('AT611904300234573201');
  });
});

describe('formatIban', () => {
  it('groups into blocks of 4', () => {
    expect(formatIban('AT611904300234573201')).toBe('AT61 1904 3002 3457 3201');
  });
  it('handles already-formatted input', () => {
    expect(formatIban('DE89 3704 0044 0532 0130 00')).toBe(
      'DE89 3704 0044 0532 0130 00',
    );
  });
});

describe('isValidIban', () => {
  it('accepts valid AT IBANs', () => {
    expect(isValidIban('AT61 1904 3002 3457 3201')).toBe(true);
    expect(isValidIban('AT022050302101023600')).toBe(true);
  });

  it('accepts valid DE IBANs', () => {
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(isValidIban('DE12500105170648489890')).toBe(true);
  });

  it('rejects IBANs with bad check digits', () => {
    expect(isValidIban('AT61 1904 3002 3457 3202')).toBe(false);
    expect(isValidIban('DE89 3704 0044 0532 0130 01')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidIban('')).toBe(false);
    expect(isValidIban('AT')).toBe(false);
    expect(isValidIban('1234567890')).toBe(false);
    expect(isValidIban('XX99 0000 0000 0000 0000')).toBe(false);
    expect(isValidIban('AT61-1904-3002-3457-3201')).toBe(false);
  });

  it('rejects too-short and too-long IBANs', () => {
    expect(isValidIban('AT611904')).toBe(false);
    expect(isValidIban('AT' + '0'.repeat(40))).toBe(false);
  });
});
