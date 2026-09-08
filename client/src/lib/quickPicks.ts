import type { Dish, ReorderSuggestion } from '../types/api';

export type QuickPick =
  | { kind: 'favorite'; dish: Dish }
  | { kind: 'suggestion'; suggestion: ReorderSuggestion };

export const MAX_QUICK_PICKS = 6;

// One "Schnellauswahl" row: favorites first (menu order), then recent orders
// that are not already covered by a favorite of the same dish.
export function mergeQuickPicks(
  dishes: Dish[],
  favoriteIds: Set<string>,
  suggestions: ReorderSuggestion[],
  max = MAX_QUICK_PICKS,
): QuickPick[] {
  const out: QuickPick[] = [];
  for (const dish of dishes) {
    if (favoriteIds.has(dish.id)) out.push({ kind: 'favorite', dish });
  }
  for (const suggestion of suggestions) {
    if (suggestion.dish_id !== null && favoriteIds.has(suggestion.dish_id)) continue;
    out.push({ kind: 'suggestion', suggestion });
  }
  return out.slice(0, max);
}
