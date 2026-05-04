import { describe, it, expect } from 'vitest';
import { parsePrice, fmtPrice } from './price';

describe('parsePrice', () => {
  it('parses German comma decimal', () => {
    expect(parsePrice('9,50')).toBe(950);
    expect(parsePrice('0,99')).toBe(99);
  });

  it('parses dot decimal', () => {
    expect(parsePrice('9.50')).toBe(950);
    expect(parsePrice('12.00')).toBe(1200);
  });

  it('strips trailing or leading euro sign', () => {
    expect(parsePrice('9,50 €')).toBe(950);
    expect(parsePrice('€ 9,50')).toBe(950);
    expect(parsePrice('11,00€')).toBe(1100);
  });

  it('parses integers', () => {
    expect(parsePrice('5')).toBe(500);
  });

  it('handles thousands separator', () => {
    expect(parsePrice('1.234,56')).toBe(123456);
    expect(parsePrice('1,234.56')).toBe(123456);
  });

  it('rejects malformed input', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('1,2,3')).toBeNull();
    expect(parsePrice('  ')).toBeNull();
  });
});

describe('fmtPrice', () => {
  it('formats cents as de-AT EUR', () => {
    const out = fmtPrice(950);
    expect(out).toMatch(/9,50/);
    expect(out).toMatch(/€/);
  });

  it('formats zero', () => {
    expect(fmtPrice(0)).toMatch(/0,00/);
  });
});
