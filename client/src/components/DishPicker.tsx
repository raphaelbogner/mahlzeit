import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { addStructuredItem } from '../api/items';
import { ApiError } from '../api/client';
import { computePrice, defaultSelection } from '../lib/menuPricing';
import { fmtPrice } from '../lib/price';
import { QuantityStepper } from './QuantityStepper';

function fmtDelta(cents: number): string {
  if (cents === 0) return '';
  const sign = cents > 0 ? '+' : '−';
  return `${sign}${fmtPrice(Math.abs(cents))}`;
}
import type { Dish, Item } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { useToast } from './Toast';

import { categoryEmoji, dishCategory, fold } from '../lib/dishDisplay';
import type { DishPrefill } from '../lib/suggestions';

interface CategoryChip {
  category: string;
  emoji: string;
  count: number;
}

// Distinct categories in first-seen order (dishes arrive sorted by sort_order).
function categoryChips(dishes: Dish[]): CategoryChip[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const d of dishes) {
    const cat = dishCategory(d);
    if (!counts.has(cat)) {
      counts.set(cat, 0);
      order.push(cat);
    }
    counts.set(cat, counts.get(cat)! + 1);
  }
  return order.map((cat) => ({
    category: cat,
    emoji: categoryEmoji(cat),
    count: counts.get(cat)!,
  }));
}

export interface DishPickerProps {
  sessionId: string;
  dishes: Dish[];
  profile: Profile;
  onAdded: (item: Item) => void;
  disabled?: boolean;
  // Set by "order again" suggestions that need review; applied once per key.
  prefill?: DishPrefill | null;
  // Personal favorites (♥ on each card, filter chip). Optional.
  favoriteIds?: Set<string>;
  onToggleFavorite?: (dishId: string) => void;
}

// Sentinel for the "♥ Favoriten" filter chip (cannot clash with a category name
// because categories are trimmed user text without leading underscores... but
// we still keep it unique enough).
const FAVORITES_FILTER = '__favorites__';

export function DishPicker({
  sessionId,
  dishes,
  profile,
  onAdded,
  disabled,
  prefill,
  favoriteIds,
  onToggleFavorite,
}: DishPickerProps) {
  const [dishId, setDishId] = useState<string>(() => dishes[0]?.id ?? '');
  const dish = dishes.find((d) => d.id === dishId) ?? null;

  const initialSelection = (): Set<string> =>
    dish ? new Set(defaultSelection(dish)) : new Set<string>();
  const [trackedDishId, setTrackedDishId] = useState<string>(dishId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelection);
  if (trackedDishId !== dishId) {
    setTrackedDishId(dishId);
    setSelectedIds(initialSelection());
  }

  // null = "Alle". Otherwise a single active category filter.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { showError } = useToast();

  // Apply an incoming prefill exactly once (derived-state pattern, same as
  // the dish change above). Clears filters so the chosen dish is visible.
  const [appliedPrefillKey, setAppliedPrefillKey] = useState<number | null>(null);
  if (prefill && prefill.key !== appliedPrefillKey) {
    setAppliedPrefillKey(prefill.key);
    setDishId(prefill.dishId);
    setTrackedDishId(prefill.dishId);
    setSelectedIds(new Set(prefill.optionIds));
    setNote(prefill.note);
    setQuantity(prefill.quantity);
    setActiveCategory(null);
    setQuery('');
  }
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (appliedPrefillKey !== null) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [appliedPrefillKey]);

  const chips = useMemo<CategoryChip[]>(() => categoryChips(dishes), [dishes]);
  const favoriteCount = favoriteIds ? dishes.filter((d) => favoriteIds.has(d.id)).length : 0;
  // A single category doesn't warrant a filter row — unless favorites exist.
  const showChips = chips.length > 1 || favoriteCount > 0;

  const visibleDishes = useMemo<Dish[]>(() => {
    const q = fold(query.trim());
    return dishes.filter((d) => {
      if (activeCategory === FAVORITES_FILTER) {
        if (!favoriteIds?.has(d.id)) return false;
      } else if (activeCategory !== null && dishCategory(d) !== activeCategory) {
        return false;
      }
      if (q === '') return true;
      return (
        fold(d.name).includes(q) ||
        fold(d.description).includes(q) ||
        fold(d.category).includes(q)
      );
    });
  }, [dishes, activeCategory, query, favoriteIds]);

  if (dishes.length === 0) {
    return (
      <p className="empty">
        Dieses Restaurant hat noch keine Gerichte. Leg sie unter „Restaurants" an.
      </p>
    );
  }

  function toggleOption(groupId: string, optionId: string, isSingle: boolean): void {
    if (!dish) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (isSingle) {
        const group = dish.option_groups.find((g) => g.id === groupId);
        if (group) {
          for (const o of group.options) next.delete(o.id);
        }
        next.add(optionId);
      } else {
        if (next.has(optionId)) {
          next.delete(optionId);
        } else {
          const group = dish.option_groups.find((g) => g.id === groupId);
          if (group && group.max_select != null) {
            const count = group.options.reduce((n, o) => n + (next.has(o.id) ? 1 : 0), 0);
            if (count >= group.max_select) return current; // at cap: ignore
          }
          next.add(optionId);
        }
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!dish || disabled) return;

    setSubmitting(true);
    try {
      const item = await addStructuredItem(sessionId, {
        user_id: profile.user_id,
        user_name: profile.user_name,
        dish_id: dish.id,
        option_ids: Array.from(selectedIds),
        note: note.trim(),
        quantity,
      });
      onAdded(item);
      setSelectedIds(new Set(defaultSelection(dish)));
      setNote('');
      setQuantity(1);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Eintrag fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalCents = dish ? computePrice(dish, selectedIds) : 0;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="card-pad space-y-4" noValidate>
      <div>
        <label htmlFor="dish-search" className="label">
          Gericht
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          >
            🔍
          </span>
          <input
            id="dish-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gericht suchen…"
            disabled={disabled || submitting}
            className="input pl-9"
            autoComplete="off"
          />
        </div>

        {showChips ? (
          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Kategorie filtern">
            <CategoryButton
              label="Alle"
              emoji="🍽️"
              count={dishes.length}
              active={activeCategory === null}
              onClick={() => setActiveCategory(null)}
              disabled={disabled || submitting}
            />
            {favoriteCount > 0 ? (
              <CategoryButton
                label="Favoriten"
                emoji="♥"
                count={favoriteCount}
                active={activeCategory === FAVORITES_FILTER}
                onClick={() => setActiveCategory(FAVORITES_FILTER)}
                disabled={disabled || submitting}
              />
            ) : null}
            {chips.map((c) => (
              <CategoryButton
                key={c.category}
                label={c.category}
                emoji={c.emoji}
                count={c.count}
                active={activeCategory === c.category}
                onClick={() => setActiveCategory(c.category)}
                disabled={disabled || submitting}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-2 max-h-96 overflow-auto rounded-xl bg-stone-50/60 p-2 ring-1 ring-stone-200">
          {visibleDishes.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-stone-500">
              Keine Treffer{query.trim() !== '' ? ` für „${query.trim()}"` : ''}.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visibleDishes.map((d) => {
                const selected = d.id === dishId;
                return (
                  <li key={d.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setDishId(d.id)}
                      disabled={disabled || submitting}
                      aria-pressed={selected}
                      className={
                        'flex h-full w-full flex-col rounded-xl bg-white p-3 text-left shadow-sm ring-1 transition ' +
                        (selected
                          ? 'ring-2 ring-orange-400'
                          : 'ring-stone-200 hover:ring-orange-200')
                      }
                    >
                      <span className="flex items-start gap-2">
                        <span aria-hidden="true" className="text-lg leading-none">
                          {categoryEmoji(dishCategory(d))}
                        </span>
                        <span className="min-w-0 flex-1 font-medium text-stone-900">
                          {d.name}
                        </span>
                        {d.is_vegetarian ? (
                          <span
                            className="shrink-0 text-sm"
                            title="Vegetarisch"
                            aria-label="Vegetarisch"
                          >
                            🌱
                          </span>
                        ) : null}
                      </span>
                      {d.description.trim() !== '' ? (
                        <span className="mt-1 line-clamp-2 text-xs leading-snug text-stone-500">
                          {d.description}
                        </span>
                      ) : null}
                      <span className="mt-2 text-sm font-semibold text-stone-800 tabular-nums">
                        {fmtPrice(d.base_price_cents)}
                      </span>
                    </button>
                    {onToggleFavorite ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(d.id);
                        }}
                        disabled={disabled || submitting}
                        aria-pressed={favoriteIds?.has(d.id) ?? false}
                        aria-label={
                          favoriteIds?.has(d.id)
                            ? `${d.name} aus Favoriten entfernen`
                            : `${d.name} als Favorit speichern`
                        }
                        title={favoriteIds?.has(d.id) ? 'Favorit entfernen' : 'Als Favorit speichern'}
                        className={
                          'absolute right-2 bottom-2 grid h-7 w-7 place-items-center rounded-full text-base leading-none transition ' +
                          (favoriteIds?.has(d.id)
                            ? 'bg-rose-50 text-rose-500 ring-1 ring-rose-200'
                            : 'text-stone-300 hover:bg-stone-100 hover:text-rose-400')
                        }
                      >
                        {favoriteIds?.has(d.id) ? '♥' : '♡'}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {dish &&
        dish.option_groups.map((group) => {
          const isSingle = group.selection_type === 'single';
          const selectedInGroup = group.options.reduce(
            (n, o) => n + (selectedIds.has(o.id) ? 1 : 0),
            0,
          );
          const cap = !isSingle ? group.max_select : null;
          const atCap = cap != null && selectedInGroup >= cap;
          return (
            <fieldset key={group.id}>
              <legend className="label flex items-center gap-2">
                <span>{group.name}</span>
                {cap != null ? (
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-xs font-medium ' +
                      (atCap ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-500')
                    }
                  >
                    {selectedInGroup}/{cap} gewählt
                  </span>
                ) : null}
              </legend>
              <div className="space-y-1">
                {group.options.map((opt) => {
                  const checked = selectedIds.has(opt.id);
                  const lockedOut = !isSingle && atCap && !checked;
                  return (
                    <label
                      key={opt.id}
                      className={
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ring-1 transition ' +
                        (checked
                          ? 'cursor-pointer bg-orange-50 ring-orange-200 text-stone-900'
                          : lockedOut
                            ? 'cursor-not-allowed text-stone-400 ring-transparent'
                            : 'cursor-pointer ring-transparent hover:bg-stone-50')
                      }
                    >
                      <input
                        type={isSingle ? 'radio' : 'checkbox'}
                        name={isSingle ? `group-${group.id}` : undefined}
                        checked={checked}
                        onChange={() => toggleOption(group.id, opt.id, isSingle)}
                        disabled={disabled || submitting || lockedOut}
                        className="accent-orange-500"
                      />
                      <span className="flex-1">{opt.name}</span>
                      <span className="text-xs text-stone-500 tabular-nums">
                        {fmtDelta(opt.price_delta_cents)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

      <div>
        <label htmlFor="picker-note" className="label">
          Anmerkung <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="picker-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="z. B. ohne Knoblauch"
          disabled={disabled || submitting}
          className="input"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/80 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            disabled={disabled || submitting}
            label={dish ? `Menge für ${dish.name}` : 'Menge'}
          />
          <p className="text-sm text-stone-700 tabular-nums">
            {quantity > 1 ? (
              <>
                <span className="text-stone-500">
                  {quantity} × {fmtPrice(totalCents)} ={' '}
                </span>
                <span className="text-base font-semibold text-stone-900">
                  {fmtPrice(totalCents * quantity)}
                </span>
              </>
            ) : (
              <>
                Endpreis:{' '}
                <span className="text-base font-semibold text-stone-900">
                  {fmtPrice(totalCents)}
                </span>
              </>
            )}
          </p>
        </div>
        <button
          type="submit"
          disabled={disabled || submitting || !dish}
          className="btn-primary"
        >
          {submitting ? 'Wird hinzugefügt…' : 'Hinzufügen'}
        </button>
      </div>
    </form>
  );
}

interface CategoryButtonProps {
  label: string;
  emoji: string;
  count: number;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function CategoryButton({ label, emoji, count, active, onClick, disabled }: CategoryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ' +
        (active
          ? 'bg-orange-500 text-white shadow-sm'
          : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-orange-200')
      }
    >
      <span aria-hidden="true">{emoji}</span>
      <span>{label}</span>
      <span className={active ? 'text-orange-100' : 'text-stone-400'}>{count}</span>
    </button>
  );
}
