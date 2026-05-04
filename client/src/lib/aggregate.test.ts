import { describe, it, expect } from 'vitest';
import { aggregateByDish } from './aggregate';

describe('aggregateByDish', () => {
  it('groups identical names', () => {
    const rows = aggregateByDish([
      { dish: 'Pizza', price_cents: 950 },
      { dish: 'Pizza', price_cents: 950 },
      { dish: 'Salat', price_cents: 700 },
    ]);
    expect(rows).toHaveLength(2);
    const pizza = rows.find((r) => r.key === 'pizza')!;
    expect(pizza.count).toBe(2);
    expect(pizza.totalCents).toBe(1900);
  });

  it('groups case-insensitively and trims whitespace', () => {
    const rows = aggregateByDish([
      { dish: 'Pizza', price_cents: 1000 },
      { dish: 'pizza', price_cents: 1000 },
      { dish: '  PIZZA  ', price_cents: 1000 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.count).toBe(3);
    expect(rows[0]!.totalCents).toBe(3000);
    expect(rows[0]!.dish).toBe('Pizza');
  });

  it('treats null prices as zero', () => {
    const rows = aggregateByDish([
      { dish: 'Suppe', price_cents: null },
      { dish: 'Suppe', price_cents: 500 },
    ]);
    expect(rows[0]!.totalCents).toBe(500);
    expect(rows[0]!.count).toBe(2);
  });

  it('returns empty array on empty input', () => {
    expect(aggregateByDish([])).toEqual([]);
  });
});
