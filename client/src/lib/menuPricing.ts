import type { Dish, DishOption } from '../types/api';

// Pure helper: returns the total price in cents for a dish given the set of
// selected option ids. Selections in groups not belonging to the dish are
// ignored. Single-selection groups are not enforced here — that's UI / server
// concern; this function just sums whatever is selected.
export function computePrice(dish: Dish, selectedOptionIds: Iterable<string>): number {
  const selected = selectedOptionIds instanceof Set
    ? selectedOptionIds
    : new Set<string>(selectedOptionIds);

  let total = dish.base_price_cents;
  for (const group of dish.option_groups) {
    for (const option of group.options) {
      if (selected.has(option.id)) {
        total += option.price_delta_cents;
      }
    }
  }
  return total;
}

// Returns the initial selection for a dish: the first option of every
// single-selection group, nothing for multi-selection groups.
export function defaultSelection(dish: Dish): string[] {
  const ids: string[] = [];
  for (const group of dish.option_groups) {
    if (group.selection_type === 'single' && group.options.length > 0) {
      ids.push(group.options[0]!.id);
    }
  }
  return ids;
}

// Convenience: lookup an option by id across a dish.
export function findOption(dish: Dish, optionId: string): DishOption | null {
  for (const group of dish.option_groups) {
    for (const option of group.options) {
      if (option.id === optionId) return option;
    }
  }
  return null;
}
