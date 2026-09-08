import { describe, it, expect } from 'vitest';
import { formatSnapshotOptions, resolveSuggestion } from './suggestions';
import type { Dish, ReorderSuggestion } from '../types/api';

const dish: Dish = {
  id: 'dish000000000001',
  restaurant_id: 'rest000000000001',
  name: 'Dürüm',
  category: 'Dürüm',
  description: '',
  base_price_cents: 600,
  is_vegetarian: false,
  sort_order: 0,
  option_groups: [
    {
      id: 'grp0000000000001',
      dish_id: 'dish000000000001',
      name: 'Schärfe',
      selection_type: 'single',
      max_select: null,
      sort_order: 0,
      options: [
        { id: 'opt0000000000001', group_id: 'grp0000000000001', name: 'mild', price_delta_cents: 0, sort_order: 0 },
        { id: 'opt0000000000002', group_id: 'grp0000000000001', name: 'scharf', price_delta_cents: 0, sort_order: 1 },
      ],
    },
    {
      id: 'grp0000000000002',
      dish_id: 'dish000000000001',
      name: 'Extras',
      selection_type: 'multi',
      max_select: 1,
      sort_order: 1,
      options: [
        { id: 'opt0000000000003', group_id: 'grp0000000000002', name: 'Käse', price_delta_cents: 50, sort_order: 0 },
        { id: 'opt0000000000004', group_id: 'grp0000000000002', name: 'Halloumi', price_delta_cents: 150, sort_order: 1 },
      ],
    },
  ],
};

function suggestion(partial: Partial<ReorderSuggestion>): ReorderSuggestion {
  return {
    kind: 'structured',
    dish_id: dish.id,
    dish: dish.name,
    options: [],
    note: '',
    quantity: 1,
    price_cents: 600,
    last_ordered_at: '2026-09-01T10:00:00Z',
    times_ordered: 1,
    ...partial,
  };
}

describe('resolveSuggestion', () => {
  it('resolves an exact match by group and option names and recomputes the price', () => {
    const r = resolveSuggestion(
      [dish],
      suggestion({
        options: [
          { group: 'Schärfe', name: 'scharf', delta_cents: 0 },
          { group: 'Extras', name: 'Käse', delta_cents: 50 },
        ],
      }),
    );
    expect(r.status).toBe('exact');
    if (r.status !== 'exact') return;
    expect(r.optionIds).toEqual(['opt0000000000002', 'opt0000000000003']);
    expect(r.priceCents).toBe(650);
  });

  it('marks the suggestion partial when an option disappeared and falls back on single groups', () => {
    const r = resolveSuggestion(
      [dish],
      suggestion({ options: [{ group: 'Schärfe', name: 'extra scharf', delta_cents: 0 }] }),
    );
    expect(r.status).toBe('partial');
    if (r.status !== 'partial') return;
    expect(r.optionIds).toEqual(['opt0000000000001']);
  });

  it('marks partial when a whole group vanished from the menu', () => {
    const r = resolveSuggestion(
      [dish],
      suggestion({
        options: [
          { group: 'Schärfe', name: 'mild', delta_cents: 0 },
          { group: 'Sauce', name: 'Knoblauch', delta_cents: 0 },
        ],
      }),
    );
    expect(r.status).toBe('partial');
  });

  it('respects max_select on multi groups', () => {
    const r = resolveSuggestion(
      [dish],
      suggestion({
        options: [
          { group: 'Schärfe', name: 'mild', delta_cents: 0 },
          { group: 'Extras', name: 'Käse', delta_cents: 50 },
          { group: 'Extras', name: 'Halloumi', delta_cents: 150 },
        ],
      }),
    );
    expect(r.status).toBe('partial');
    if (r.status !== 'partial') return;
    expect(r.optionIds).toHaveLength(2);
  });

  it('reports missing dishes and passes freetext through', () => {
    expect(resolveSuggestion([], suggestion({})).status).toBe('missing');
    expect(
      resolveSuggestion([dish], suggestion({ kind: 'freetext', dish_id: null, dish: 'Suppe' })).status,
    ).toBe('freetext');
  });
});

describe('formatSnapshotOptions', () => {
  it('groups option names by group', () => {
    expect(
      formatSnapshotOptions([
        { group: 'Extras', name: 'Käse', delta_cents: 50 },
        { group: 'Schärfe', name: 'scharf', delta_cents: 0 },
        { group: 'Extras', name: 'Halloumi', delta_cents: 150 },
      ]),
    ).toBe('Extras: Käse, Halloumi · Schärfe: scharf');
    expect(formatSnapshotOptions([])).toBe('');
  });
});
