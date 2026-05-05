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

  // Reset selection whenever the picked dish changes, using React 19's
  // "compare prev vs. current during render" idiom.
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
      <p className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-600">
        Dieses Restaurant hat noch keine Gerichte. Leg sie unter „Restaurants
        verwalten" an.
      </p>
    );
  }

  function toggleOption(groupId: string, optionId: string, isSingle: boolean): void {
    if (!dish) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (isSingle) {
        // Replace any other option of this group.
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
      // Reset only the note + selections; keep the dish selected for fast re-orders.
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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded border border-gray-200 bg-white p-4"
      noValidate
    >
      <div>
        <label htmlFor="dish-select" className="mb-1 block text-sm font-medium">
          Gericht
        </label>
        <select
          id="dish-select"
          value={dishId}
          onChange={(e) => setDishId(e.target.value)}
          disabled={disabled || submitting}
          className="w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100"
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
          <fieldset key={group.id} className="space-y-1">
            <legend className="text-sm font-medium">{group.name}</legend>
            {group.options.map((opt) => {
              const isSingle = group.selection_type === 'single';
              const checked = selectedIds.has(opt.id);
              return (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-gray-50"
                >
                  <input
                    type={isSingle ? 'radio' : 'checkbox'}
                    name={isSingle ? `group-${group.id}` : undefined}
                    checked={checked}
                    onChange={() => toggleOption(group.id, opt.id, isSingle)}
                    disabled={disabled || submitting}
                  />
                  <span className="flex-1">{opt.name}</span>
                  <span className="text-xs text-gray-600">
                    {fmtDelta(opt.price_delta_cents)}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}

      <div>
        <label htmlFor="picker-note" className="mb-1 block text-sm font-medium">
          Anmerkung <span className="text-gray-500">(optional)</span>
        </label>
        <input
          id="picker-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="z. B. ohne Knoblauch"
          disabled={disabled || submitting}
          className="w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Endpreis: {fmtPrice(totalCents)}</p>
        <button
          type="submit"
          disabled={disabled || submitting || !dish}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Wird hinzugefügt…' : 'Hinzufügen'}
        </button>
      </div>
    </form>
  );
}
