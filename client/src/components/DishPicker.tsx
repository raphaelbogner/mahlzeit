import { useState } from 'react';
import type { FormEvent } from 'react';
import { addStructuredItem } from '../api/items';
import { ApiError } from '../api/client';
import { computePrice, defaultSelection } from '../lib/menuPricing';
import { fmtPrice } from '../lib/price';

function fmtDelta(cents: number): string {
  if (cents === 0) return '';
  const sign = cents > 0 ? '+' : '−';
  return `${sign}${fmtPrice(Math.abs(cents))}`;
}
import type { Dish, Item } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { useToast } from './Toast';

export interface DishPickerProps {
  sessionId: string;
  dishes: Dish[];
  profile: Profile;
  onAdded: (item: Item) => void;
  disabled?: boolean;
}

export function DishPicker({
  sessionId,
  dishes,
  profile,
  onAdded,
  disabled,
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

  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { showError } = useToast();

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
        if (next.has(optionId)) next.delete(optionId);
        else next.add(optionId);
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
      });
      onAdded(item);
      setSelectedIds(new Set(defaultSelection(dish)));
      setNote('');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Eintrag fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalCents = dish ? computePrice(dish, selectedIds) : 0;

  return (
    <form onSubmit={handleSubmit} className="card-pad space-y-4" noValidate>
      <div>
        <label htmlFor="dish-select" className="label">
          Gericht
        </label>
        <select
          id="dish-select"
          value={dishId}
          onChange={(e) => setDishId(e.target.value)}
          disabled={disabled || submitting}
          className="input"
        >
          {dishes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {fmtPrice(d.base_price_cents)}
            </option>
          ))}
        </select>
      </div>

      {dish &&
        dish.option_groups.map((group) => (
          <fieldset key={group.id}>
            <legend className="label">{group.name}</legend>
            <div className="space-y-1">
              {group.options.map((opt) => {
                const isSingle = group.selection_type === 'single';
                const checked = selectedIds.has(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={
                      'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm ring-1 transition ' +
                      (checked
                        ? 'bg-orange-50 ring-orange-200 text-stone-900'
                        : 'ring-transparent hover:bg-stone-50')
                    }
                  >
                    <input
                      type={isSingle ? 'radio' : 'checkbox'}
                      name={isSingle ? `group-${group.id}` : undefined}
                      checked={checked}
                      onChange={() => toggleOption(group.id, opt.id, isSingle)}
                      disabled={disabled || submitting}
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
        ))}

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

      <div className="flex items-center justify-between gap-3 border-t border-stone-200/80 pt-4">
        <p className="text-sm text-stone-700 tabular-nums">
          Endpreis:{' '}
          <span className="text-base font-semibold text-stone-900">{fmtPrice(totalCents)}</span>
        </p>
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
