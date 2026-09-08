import type { Dish } from '../types/api';

// Fold to lowercase and strip diacritics so "durum" matches "Dürüm".
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

// Emoji for a category label. Substring match keeps it forgiving
// ("Kebap Box" still reads as a box). Falls back to a neutral plate.
export function categoryEmoji(category: string): string {
  const c = fold(category);
  if (c.includes('pizza')) return '🍕';
  if (c.includes('box')) return '🍟';
  if (c.includes('durum')) return '🌯';
  if (c.includes('kebap') || c.includes('kebab')) return '🥙';
  if (c.includes('getrank') || c.includes('drink') || c.includes('cola')) return '🥤';
  if (c.includes('dessert') || c.includes('nachspeise') || c.includes('suss')) return '🍰';
  if (c.includes('salat') || c.includes('vorspeise')) return '🥗';
  return '🍽️';
}

export const UNCATEGORISED = 'Weitere';

export function dishCategory(d: Dish): string {
  return d.category.trim() === '' ? UNCATEGORISED : d.category.trim();
}
