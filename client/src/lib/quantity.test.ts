import { describe, it, expect } from 'vitest';
import { clampQuantity, lineTotalCents, parseQuantity, MAX_QUANTITY, MIN_QUANTITY } from './quantity';

describe('clampQuantity', () => {
  it('keeps values inside the range', () => {
    expect(clampQuantity(1)).toBe(1);
    expect(clampQuantity(7)).toBe(7);
    expect(clampQuantity(20)).toBe(20);
  });

  it('clamps below the minimum and above the maximum', () => {
    expect(clampQuantity(0)).toBe(MIN_QUANTITY);
    expect(clampQuantity(-5)).toBe(MIN_QUANTITY);
    expect(clampQuantity(21)).toBe(MAX_QUANTITY);
    expect(clampQuantity(999)).toBe(MAX_QUANTITY);
  });

  it('truncates fractions and treats NaN as the minimum', () => {
    expect(clampQuantity(2.9)).toBe(2);
    expect(clampQuantity(Number.NaN)).toBe(MIN_QUANTITY);
    expect(clampQuantity(Number.POSITIVE_INFINITY)).toBe(MIN_QUANTITY);
  });
});

describe('parseQuantity', () => {
  it('parses plain integers and clamps them', () => {
    expect(parseQuantity('3')).toBe(3);
    expect(parseQuantity(' 12 ')).toBe(12);
    expect(parseQuantity('0')).toBe(1);
    expect(parseQuantity('50')).toBe(20);
  });

  it('rejects anything that is not a plain integer', () => {
    expect(parseQuantity('')).toBeNull();
    expect(parseQuantity('2,5')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
  });
});

describe('lineTotalCents', () => {
  it('multiplies unit price by quantity', () => {
    expect(lineTotalCents(250, 3)).toBe(750);
    expect(lineTotalCents(250, 1)).toBe(250);
  });

  it('returns null for unpriced items', () => {
    expect(lineTotalCents(null, 3)).toBeNull();
  });
});
