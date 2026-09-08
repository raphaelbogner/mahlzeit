import { describe, it, expect } from 'vitest';
import { barWidth, maxOf, rangeLabel } from './stats';

describe('stats helpers', () => {
  it('scales bars to the max with a visible minimum', () => {
    expect(barWidth(100, 100)).toBe(100);
    expect(barWidth(50, 100)).toBe(50);
    expect(barWidth(1, 1000)).toBe(3);
    expect(barWidth(0, 100)).toBe(0);
    expect(barWidth(10, 0)).toBe(0);
  });

  it('finds the maximum of a projection', () => {
    expect(maxOf([{ v: 3 }, { v: 9 }, { v: 4 }], (r) => r.v)).toBe(9);
    expect(maxOf([], () => 1)).toBe(0);
  });

  it('labels ranges in German', () => {
    expect(rangeLabel('30d')).toBe('30 Tage');
    expect(rangeLabel('all')).toBe('Gesamt');
  });
});
