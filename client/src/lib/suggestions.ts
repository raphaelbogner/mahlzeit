import type { Dish, ItemOptionSnapshot, ReorderSuggestion } from '../types/api';
import { computePrice } from './menuPricing';

// What the DishPicker should preselect when a suggestion cannot be added
// directly (menu changed) — or when the user wants to review it first.
export interface DishPrefill {
  // Changes on every prefill so the same suggestion can be applied twice.
  key: number;
  dishId: string;
  optionIds: string[];
  note: string;
  quantity: number;
}

export type ResolvedSuggestion =
  | { status: 'freetext' }
  | { status: 'missing' }
  | { status: 'exact' | 'partial'; dish: Dish; optionIds: string[]; priceCents: number };

// Map a historic option snapshot onto the current menu by group name +
// option name. 'exact' = everything matched, 'partial' = something changed
// (option gone, group gone, dish reshaped) and the picker should be shown.
export function resolveSuggestion(dishes: Dish[], s: ReorderSuggestion): ResolvedSuggestion {
  // Menu edits used to regenerate dish ids (items.dish_id → NULL), so old
  // orders may only carry the dish name. Match by id first, then by name;
  // a nameless match on a snapshot without options is a genuine freetext item.
  const byId = s.dish_id !== null ? dishes.find((d) => d.id === s.dish_id) : undefined;
  const dish = byId ?? findDishByName(dishes, s.dish);
  if (!dish) {
    return s.dish_id === null && s.options.length === 0 ? { status: 'freetext' } : { status: 'missing' };
  }

  const wanted = new Map<string, Set<string>>();
  for (const o of s.options) {
    const set = wanted.get(o.group) ?? new Set<string>();
    set.add(o.name);
    wanted.set(o.group, set);
  }

  let partial = false;
  const optionIds: string[] = [];
  for (const group of dish.option_groups) {
    const names = wanted.get(group.name) ?? new Set<string>();
    const matched = group.options.filter((o) => names.has(o.name)).map((o) => o.id);
    if (matched.length !== names.size) partial = true;

    if (group.selection_type === 'single') {
      if (matched.length >= 1) {
        optionIds.push(matched[0]!);
      } else {
        // Required group with no match: fall back to the first option so the
        // picker opens in a valid state.
        partial = true;
        if (group.options[0]) optionIds.push(group.options[0].id);
      }
    } else {
      const take = group.max_select != null ? matched.slice(0, group.max_select) : matched;
      if (take.length !== matched.length) partial = true;
      optionIds.push(...take);
    }
  }
  for (const groupName of wanted.keys()) {
    if (!dish.option_groups.some((g) => g.name === groupName)) partial = true;
  }

  return {
    status: partial ? 'partial' : 'exact',
    dish,
    optionIds,
    priceCents: computePrice(dish, optionIds),
  };
}

function findDishByName(dishes: Dish[], name: string): Dish | undefined {
  const key = name.trim().toLocaleLowerCase('de');
  if (key === '') return undefined;
  return dishes.find((d) => d.name.trim().toLocaleLowerCase('de') === key);
}

// "Größe: Mittel · Toppings: Käse, Salami"
export function formatSnapshotOptions(options: ItemOptionSnapshot[]): string {
  if (options.length === 0) return '';
  const byGroup = new Map<string, string[]>();
  for (const o of options) {
    const arr = byGroup.get(o.group);
    if (arr) arr.push(o.name);
    else byGroup.set(o.group, [o.name]);
  }
  const parts: string[] = [];
  for (const [group, names] of byGroup) parts.push(`${group}: ${names.join(', ')}`);
  return parts.join(' · ');
}
