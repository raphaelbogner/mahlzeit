import { describe, it, expect } from 'vitest';
import { mergeQuickPicks } from './quickPicks';
import type { Dish, ReorderSuggestion } from '../types/api';

function dish(id: string, sort: number): Dish {
  return {
    id,
    restaurant_id: 'rest000000000001',
    name: id,
    category: '',
    description: '',
    base_price_cents: 500,
    is_vegetarian: false,
    sort_order: sort,
    option_groups: [],
  };
}

function suggestion(dishId: string | null, name = 'x'): ReorderSuggestion {
  return {
    kind: dishId ? 'structured' : 'freetext',
    dish_id: dishId,
    dish: name,
    options: [],
    note: '',
    quantity: 1,
    price_cents: 500,
    last_ordered_at: null,
    times_ordered: 1,
  };
}

describe('mergeQuickPicks', () => {
  const dishes = [dish('d1', 0), dish('d2', 1), dish('d3', 2)];

  it('puts favorites first in menu order and drops duplicate suggestions', () => {
    const picks = mergeQuickPicks(dishes, new Set(['d3', 'd1']), [
      suggestion('d1', 'd1'),
      suggestion('d2', 'd2'),
      suggestion(null, 'Suppe'),
    ]);
    expect(picks.map((p) => (p.kind === 'favorite' ? `F:${p.dish.id}` : `S:${p.suggestion.dish}`))).toEqual([
      'F:d1',
      'F:d3',
      'S:d2',
      'S:Suppe',
    ]);
  });

  it('caps the row', () => {
    const many = Array.from({ length: 10 }, (_, i) => suggestion(null, `s${i}`));
    expect(mergeQuickPicks(dishes, new Set(), many, 4)).toHaveLength(4);
  });

  it('returns empty when there is nothing to show', () => {
    expect(mergeQuickPicks(dishes, new Set(), [])).toEqual([]);
  });
});
