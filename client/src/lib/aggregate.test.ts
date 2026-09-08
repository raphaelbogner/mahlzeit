import { describe, it, expect } from 'vitest';
import { aggregateItems, renderSummaryText } from './aggregate';
import type { Item } from '../types/api';

function makeItem(partial: Partial<Item> & Pick<Item, 'id' | 'user_name' | 'dish'>): Item {
  return {
    id: partial.id,
    session_id: partial.session_id ?? 'sess000000000000',
    user_id: partial.user_id ?? 'user000000000000',
    user_name: partial.user_name,
    dish_id: partial.dish_id ?? null,
    dish: partial.dish,
    note: partial.note ?? '',
    price_cents: partial.price_cents ?? null,
    quantity: partial.quantity ?? 1,
    options: partial.options ?? null,
    added_at: partial.added_at ?? '2026-05-05 10:00:00',
    paid_at: partial.paid_at ?? null,
  };
}

describe('aggregateItems', () => {
  it('returns empty aggregate for no items', () => {
    const agg = aggregateItems([]);
    expect(agg.lines).toEqual([]);
    expect(agg.per_person).toEqual([]);
    expect(agg.grand_total_cents).toBe(0);
    expect(agg.has_any_price).toBe(false);
  });

  it('does NOT merge same dish with different options', () => {
    const items: Item[] = [
      makeItem({
        id: 'i1aaaaaaaaaaaaaa',
        user_name: 'Anna',
        dish: 'Pizza',
        price_cents: 950,
        options: [{ group: 'Größe', name: 'Klein', delta_cents: 0 }],
      }),
      makeItem({
        id: 'i2aaaaaaaaaaaaaa',
        user_name: 'Ben',
        dish: 'Pizza',
        price_cents: 1250,
        options: [{ group: 'Größe', name: 'Groß', delta_cents: 300 }],
      }),
    ];
    const agg = aggregateItems(items);
    expect(agg.lines).toHaveLength(2);
  });

  it('merges identical dish + options regardless of option array order', () => {
    const items: Item[] = [
      makeItem({
        id: 'i1aaaaaaaaaaaaaa',
        user_name: 'Anna',
        dish: 'Pizza',
        price_cents: 1100,
        options: [
          { group: 'Größe', name: 'Mittel', delta_cents: 150 },
          { group: 'Toppings', name: 'extra Käse', delta_cents: 100 },
        ],
      }),
      makeItem({
        id: 'i2aaaaaaaaaaaaaa',
        user_name: 'Ben',
        dish: 'Pizza',
        price_cents: 1100,
        options: [
          { group: 'Toppings', name: 'extra Käse', delta_cents: 100 },
          { group: 'Größe', name: 'Mittel', delta_cents: 150 },
        ],
      }),
    ];
    const agg = aggregateItems(items);
    expect(agg.lines).toHaveLength(1);
    expect(agg.lines[0]!.count).toBe(2);
    expect(agg.lines[0]!.total_cents).toBe(2200);
    expect(agg.lines[0]!.unit_price_cents).toBe(1100);
    expect(agg.lines[0]!.users).toEqual(['Anna', 'Ben']);
  });

  it('handles freetext items with null price', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'Suppe', price_cents: null }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'Suppe', price_cents: null }),
    ];
    const agg = aggregateItems(items);
    expect(agg.lines).toHaveLength(1);
    expect(agg.lines[0]!.count).toBe(2);
    expect(agg.lines[0]!.total_cents).toBeNull();
    expect(agg.lines[0]!.unit_price_cents).toBeNull();
    expect(agg.has_any_price).toBe(false);
  });

  it('drops unit price when same bucket has different prices', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'Salat', price_cents: 700 }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Ben', dish: 'Salat', price_cents: 800 }),
    ];
    const agg = aggregateItems(items);
    expect(agg.lines).toHaveLength(1);
    expect(agg.lines[0]!.unit_price_cents).toBeNull();
    expect(agg.lines[0]!.total_cents).toBe(1500);
  });

  it('computes per-person totals sorted with de locale', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Örni', dish: 'A', price_cents: 100 }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'A', price_cents: 200 }),
      makeItem({ id: 'i3aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'B', price_cents: 50 }),
    ];
    const agg = aggregateItems(items);
    expect(agg.per_person.map((p) => p.user_name)).toEqual(['Anna', 'Örni']);
    expect(agg.per_person[0]!.total_cents).toBe(250);
    expect(agg.per_person[1]!.total_cents).toBe(100);
    expect(agg.grand_total_cents).toBe(350);
  });

  it('collects notes per line with attribution and merges identical dishes', () => {
    const items: Item[] = [
      makeItem({
        id: 'i1aaaaaaaaaaaaaa',
        user_name: 'Anna',
        dish: 'Pizza',
        price_cents: 950,
        note: 'ohne Zwiebel',
      }),
      makeItem({
        id: 'i2aaaaaaaaaaaaaa',
        user_name: 'Ben',
        dish: 'Pizza',
        price_cents: 950,
      }),
      makeItem({
        id: 'i3aaaaaaaaaaaaaa',
        user_name: 'Clara',
        dish: 'Pizza',
        price_cents: 950,
        note: 'extra scharf',
      }),
    ];
    const agg = aggregateItems(items);
    expect(agg.lines).toHaveLength(1);
    expect(agg.lines[0]!.count).toBe(3);
    expect(agg.lines[0]!.notes).toEqual([
      { user_name: 'Anna', note: 'ohne Zwiebel' },
      { user_name: 'Clara', note: 'extra scharf' },
    ]);
  });

  it('flags persons with unpriced items', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'A', price_cents: 200 }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'B', price_cents: null }),
    ];
    const agg = aggregateItems(items);
    expect(agg.per_person[0]!.has_unpriced_items).toBe(true);
    expect(agg.per_person[0]!.total_cents).toBe(200);
  });

  it('leaves totals untouched when there is no discount', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'A', price_cents: 2000 }),
    ];
    const agg = aggregateItems(items);
    expect(agg.discount_cents).toBe(0);
    expect(agg.net_total_cents).toBe(2000);
    expect(agg.per_person[0]!.discount_cents).toBe(0);
    expect(agg.per_person[0]!.net_cents).toBe(2000);
  });

  it('splits a discount proportionally to each person spend', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'A', price_cents: 2000 }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Bob', dish: 'B', price_cents: 1200 }),
      makeItem({ id: 'i3aaaaaaaaaaaaaa', user_name: 'Cem', dish: 'C', price_cents: 800 }),
    ];
    const agg = aggregateItems(items, 600);
    const byName = Object.fromEntries(agg.per_person.map((p) => [p.user_name, p]));
    expect(byName.Anna!.discount_cents).toBe(300);
    expect(byName.Bob!.discount_cents).toBe(180);
    expect(byName.Cem!.discount_cents).toBe(120);
    expect(byName.Anna!.net_cents).toBe(1700);
    expect(agg.discount_cents).toBe(600);
    expect(agg.net_total_cents).toBe(3400);
  });

  it('distributes rounding remainders so shares sum to the exact discount', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'A', price_cents: 100 }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Bob', dish: 'B', price_cents: 100 }),
      makeItem({ id: 'i3aaaaaaaaaaaaaa', user_name: 'Cem', dish: 'C', price_cents: 100 }),
    ];
    const agg = aggregateItems(items, 100);
    const sum = agg.per_person.reduce((s, p) => s + p.discount_cents, 0);
    expect(sum).toBe(100);
    // Each person's discount is one of the two whole-cent splits (33 or 34).
    for (const p of agg.per_person) {
      expect([33, 34]).toContain(p.discount_cents);
    }
  });

  it('caps the discount at the grand total and never goes negative', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'A', price_cents: 500 }),
    ];
    const agg = aggregateItems(items, 99999);
    expect(agg.discount_cents).toBe(500);
    expect(agg.net_total_cents).toBe(0);
    expect(agg.per_person[0]!.net_cents).toBe(0);
    expect(agg.per_person[0]!.discount_cents).toBe(500);
  });

  it('multiplies quantity into line totals, counts and per-person sums', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'Cola', price_cents: 250, quantity: 2 }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Ben', dish: 'Cola', price_cents: 250, quantity: 1 }),
      makeItem({ id: 'i3aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'Pizza', price_cents: 900, quantity: 3 }),
    ];
    const agg = aggregateItems(items);
    const cola = agg.lines.find((l) => l.dish === 'Cola')!;
    expect(cola.count).toBe(3);
    expect(cola.total_cents).toBe(750);
    expect(cola.unit_price_cents).toBe(250);
    const pizza = agg.lines.find((l) => l.dish === 'Pizza')!;
    expect(pizza.count).toBe(3);
    expect(pizza.total_cents).toBe(2700);
    const anna = agg.per_person.find((p) => p.user_name === 'Anna')!;
    expect(anna.total_cents).toBe(500 + 2700);
    expect(agg.grand_total_cents).toBe(500 + 250 + 2700);
  });

  it('applies the discount on quantity-weighted totals', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'A', price_cents: 100, quantity: 3 }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Ben', dish: 'B', price_cents: 100, quantity: 1 }),
    ];
    const agg = aggregateItems(items, 100);
    expect(agg.per_person.find((p) => p.user_name === 'Anna')!.discount_cents).toBe(75);
    expect(agg.per_person.find((p) => p.user_name === 'Ben')!.discount_cents).toBe(25);
  });

  it('gives unpriced-only people no discount', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'A', price_cents: 1000 }),
      makeItem({ id: 'i2aaaaaaaaaaaaaa', user_name: 'Bob', dish: 'B', price_cents: null }),
    ];
    const agg = aggregateItems(items, 200);
    const bob = agg.per_person.find((p) => p.user_name === 'Bob')!;
    expect(bob.discount_cents).toBe(0);
    const anna = agg.per_person.find((p) => p.user_name === 'Anna')!;
    expect(anna.discount_cents).toBe(200);
  });
});

describe('renderSummaryText', () => {
  it('produces a plain-text summary with IBAN block when applicable', () => {
    const items: Item[] = [
      makeItem({
        id: 'i1aaaaaaaaaaaaaa',
        user_name: 'Anna',
        dish: 'Pizza',
        price_cents: 1100,
        options: [{ group: 'Größe', name: 'Mittel', delta_cents: 150 }],
      }),
      makeItem({
        id: 'i2aaaaaaaaaaaaaa',
        user_name: 'Ben',
        dish: 'Pizza',
        price_cents: 1100,
        options: [{ group: 'Größe', name: 'Mittel', delta_cents: 150 }],
      }),
    ];
    const text = renderSummaryText({
      session_title: 'Mittag Mittwoch',
      restaurant_name: 'Pizzeria Roma',
      creator_name: 'Clara',
      creator_iban: 'AT611904300234573201',
      aggregate: aggregateItems(items),
    });
    expect(text).toContain('Sammelbestellung: Mittag Mittwoch');
    expect(text).toContain('Pizzeria Roma');
    expect(text).toContain('2× Pizza (Größe: Mittel)');
    expect(text).toContain('Anna, Ben');
    expect(text).toContain('Bitte überweisen an:');
    expect(text).toContain('Clara');
    expect(text).toContain('AT61 1904 3002 3457 3201');
  });

  it('includes notes with attribution in the rendered text', () => {
    const items: Item[] = [
      makeItem({
        id: 'i1aaaaaaaaaaaaaa',
        user_name: 'Anna',
        dish: 'Pizza',
        price_cents: 950,
        note: 'ohne Zwiebel',
      }),
    ];
    const text = renderSummaryText({
      session_title: 'X',
      restaurant_name: '',
      creator_name: 'Clara',
      creator_iban: '',
      aggregate: aggregateItems(items),
    });
    expect(text).toContain('Anmerkung (Anna): ohne Zwiebel');
  });

  it('omits IBAN block when no item is priced', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'Suppe', price_cents: null }),
    ];
    const text = renderSummaryText({
      session_title: 'X',
      restaurant_name: '',
      creator_name: 'Clara',
      creator_iban: 'AT611904300234573201',
      aggregate: aggregateItems(items),
    });
    expect(text).not.toContain('IBAN');
    expect(text).not.toContain('überweisen');
  });

  it('omits IBAN block when creator has no IBAN', () => {
    const items: Item[] = [
      makeItem({ id: 'i1aaaaaaaaaaaaaa', user_name: 'Anna', dish: 'Pizza', price_cents: 950 }),
    ];
    const text = renderSummaryText({
      session_title: 'X',
      restaurant_name: '',
      creator_name: 'Clara',
      creator_iban: '',
      aggregate: aggregateItems(items),
    });
    expect(text).not.toContain('IBAN');
  });
});
