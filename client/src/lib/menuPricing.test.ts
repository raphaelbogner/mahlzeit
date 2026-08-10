import { describe, it, expect } from 'vitest';
import { computePrice, defaultSelection, findOption } from './menuPricing';
import type { Dish } from '../types/api';

function makeDish(): Dish {
  return {
    id: 'dish0000000000aa',
    restaurant_id: 'rest0000000000aa',
    name: 'Margherita',
    category: 'Pizza',
    description: '',
    base_price_cents: 950,
    is_vegetarian: true,
    sort_order: 0,
    option_groups: [
      {
        id: 'grp00000000000aa',
        dish_id: 'dish0000000000aa',
        name: 'Größe',
        selection_type: 'single',
        max_select: null,
        sort_order: 0,
        options: [
          {
            id: 'optgrp1opt1aaaaa',
            group_id: 'grp00000000000aa',
            name: 'Klein',
            price_delta_cents: 0,
            sort_order: 0,
          },
          {
            id: 'optgrp1opt2aaaaa',
            group_id: 'grp00000000000aa',
            name: 'Mittel',
            price_delta_cents: 150,
            sort_order: 1,
          },
          {
            id: 'optgrp1opt3aaaaa',
            group_id: 'grp00000000000aa',
            name: 'Groß',
            price_delta_cents: 300,
            sort_order: 2,
          },
        ],
      },
      {
        id: 'grp00000000000bb',
        dish_id: 'dish0000000000aa',
        name: 'Toppings',
        selection_type: 'multi',
        max_select: null,
        sort_order: 1,
        options: [
          {
            id: 'optgrp2opt1aaaaa',
            group_id: 'grp00000000000bb',
            name: 'extra Käse',
            price_delta_cents: 100,
            sort_order: 0,
          },
          {
            id: 'optgrp2opt2aaaaa',
            group_id: 'grp00000000000bb',
            name: 'Salami',
            price_delta_cents: 150,
            sort_order: 1,
          },
        ],
      },
    ],
  };
}

describe('computePrice', () => {
  it('returns base price when no options selected', () => {
    expect(computePrice(makeDish(), [])).toBe(950);
  });

  it('adds the delta of a single selected option', () => {
    expect(computePrice(makeDish(), ['optgrp1opt2aaaaa'])).toBe(950 + 150);
  });

  it('sums deltas across single + multi selections', () => {
    const ids = ['optgrp1opt3aaaaa', 'optgrp2opt1aaaaa', 'optgrp2opt2aaaaa'];
    expect(computePrice(makeDish(), ids)).toBe(950 + 300 + 100 + 150);
  });

  it('ignores option ids that do not belong to the dish', () => {
    expect(computePrice(makeDish(), ['unknown000000000'])).toBe(950);
  });

  it('accepts a Set as input', () => {
    const set = new Set(['optgrp1opt2aaaaa', 'optgrp2opt1aaaaa']);
    expect(computePrice(makeDish(), set)).toBe(950 + 150 + 100);
  });

  it('handles a dish with no options', () => {
    const dish = makeDish();
    dish.option_groups = [];
    expect(computePrice(dish, ['anything00000000'])).toBe(950);
  });

  it('does not double-count if the same id is passed twice', () => {
    expect(computePrice(makeDish(), ['optgrp1opt2aaaaa', 'optgrp1opt2aaaaa'])).toBe(950 + 150);
  });

  it('supports negative deltas', () => {
    const dish = makeDish();
    dish.option_groups[1]!.options[0]!.price_delta_cents = -50;
    expect(computePrice(dish, ['optgrp2opt1aaaaa'])).toBe(950 - 50);
  });

  it('returns base for a zero-base dish with nothing selected', () => {
    const dish = makeDish();
    dish.base_price_cents = 0;
    expect(computePrice(dish, [])).toBe(0);
  });
});

describe('defaultSelection', () => {
  it('picks the first option of every single group', () => {
    expect(defaultSelection(makeDish())).toEqual(['optgrp1opt1aaaaa']);
  });

  it('returns an empty array if there are no single groups', () => {
    const dish = makeDish();
    dish.option_groups = dish.option_groups.filter((g) => g.selection_type !== 'single');
    expect(defaultSelection(dish)).toEqual([]);
  });

  it('skips empty single groups defensively', () => {
    const dish = makeDish();
    dish.option_groups[0]!.options = [];
    expect(defaultSelection(dish)).toEqual([]);
  });
});

describe('findOption', () => {
  it('finds an option by id', () => {
    const opt = findOption(makeDish(), 'optgrp2opt2aaaaa');
    expect(opt?.name).toBe('Salami');
  });

  it('returns null for unknown ids', () => {
    expect(findOption(makeDish(), 'unknown000000000')).toBeNull();
  });
});
