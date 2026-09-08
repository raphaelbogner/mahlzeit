import { useRef, useState } from 'react';
import { addFreeTextItem, addStructuredItem } from '../api/items';
import { ApiError } from '../api/client';
import { categoryEmoji, dishCategory } from '../lib/dishDisplay';
import { fmtPrice } from '../lib/price';
import { formatSnapshotOptions, resolveSuggestion } from '../lib/suggestions';
import type { DishPrefill } from '../lib/suggestions';
import type { Dish, Item, ReorderSuggestion } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { useToast } from './Toast';

export interface ReorderSuggestionsProps {
  sessionId: string;
  profile: Profile;
  // Current menu; empty while loading or when the restaurant has no dishes.
  dishes: Dish[];
  suggestions: ReorderSuggestion[];
  onAdded: (item: Item) => void;
  onPrefill: (prefill: DishPrefill) => void;
  disabled?: boolean;
}

const dayMonth = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit' });

function lastOrdered(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : dayMonth.format(d);
}

// "Zuletzt hier bestellt": one-click re-order cards above the dish picker.
export function ReorderSuggestions({
  sessionId,
  profile,
  dishes,
  suggestions,
  onAdded,
  onPrefill,
  disabled,
}: ReorderSuggestionsProps) {
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  // Monotonic key so the picker applies each prefill exactly once.
  const prefillSeq = useRef<number>(0);
  const { showError, showInfo } = useToast();

  if (suggestions.length === 0) return null;

  async function handlePick(index: number, s: ReorderSuggestion): Promise<void> {
    const resolved = resolveSuggestion(dishes, s);
    if (resolved.status === 'missing') return;

    if (resolved.status === 'partial') {
      onPrefill({
        key: ++prefillSeq.current,
        dishId: resolved.dish.id,
        optionIds: resolved.optionIds,
        note: s.note,
        quantity: s.quantity,
      });
      showInfo('Das Gericht hat sich geändert – bitte Auswahl prüfen.');
      return;
    }

    setBusyIndex(index);
    try {
      let item: Item;
      if (resolved.status === 'freetext') {
        item = await addFreeTextItem(sessionId, {
          user_id: profile.user_id,
          user_name: profile.user_name,
          dish: s.dish,
          note: s.note,
          price_cents: s.price_cents,
          quantity: s.quantity,
        });
      } else {
        item = await addStructuredItem(sessionId, {
          user_id: profile.user_id,
          user_name: profile.user_name,
          dish_id: resolved.dish.id,
          option_ids: resolved.optionIds,
          note: s.note,
          quantity: s.quantity,
        });
      }
      onAdded(item);
      showInfo(`${s.quantity > 1 ? `${s.quantity}× ` : ''}${s.dish} hinzugefügt.`);
    } catch (err) {
      if (
        err instanceof ApiError &&
        resolved.status === 'exact' &&
        (err.code === 'INVALID_SELECTION' || err.code === 'INVALID_OPTION' || err.code === 'DISH_NOT_FOUND')
      ) {
        // Menu changed between load and click: let the user review.
        onPrefill({
          key: ++prefillSeq.current,
          dishId: resolved.dish.id,
          optionIds: resolved.optionIds,
          note: s.note,
          quantity: s.quantity,
        });
        showInfo('Das Gericht hat sich geändert – bitte Auswahl prüfen.');
      } else {
        showError(err instanceof ApiError ? err.message : 'Eintrag fehlgeschlagen.');
      }
    } finally {
      setBusyIndex(null);
    }
  }

  return (
    <div className="card-pad">
      <h4 className="h-card mb-2">Zuletzt hier bestellt</h4>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {suggestions.map((s, index) => {
          const resolved = resolveSuggestion(dishes, s);
          const missing = resolved.status === 'missing';
          const currentDish = resolved.status === 'exact' || resolved.status === 'partial' ? resolved.dish : null;
          const emoji = currentDish ? categoryEmoji(dishCategory(currentDish)) : '🍽️';
          const unit =
            resolved.status === 'exact' || resolved.status === 'partial'
              ? resolved.priceCents
              : s.price_cents;
          const optionsText = formatSnapshotOptions(s.options);
          const busy = busyIndex === index;
          return (
            <li key={`${s.dish_id ?? s.dish}-${index}`}>
              <button
                type="button"
                onClick={() => void handlePick(index, s)}
                disabled={disabled || missing || busy}
                className={
                  'flex h-full w-full items-start gap-2 rounded-xl bg-white p-3 text-left shadow-sm ring-1 transition ' +
                  (missing
                    ? 'cursor-not-allowed opacity-60 ring-stone-200'
                    : 'ring-stone-200 hover:ring-orange-300 disabled:opacity-60')
                }
                aria-label={`${s.dish} erneut bestellen`}
              >
                <span aria-hidden="true" className="text-lg leading-none">
                  {emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium text-stone-900">
                      {s.quantity > 1 ? <span className="text-stone-500">{s.quantity}× </span> : null}
                      {s.dish}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-stone-800 tabular-nums">
                      {unit === null ? 'kein Preis' : fmtPrice(unit * s.quantity)}
                    </span>
                  </span>
                  {optionsText !== '' ? (
                    <span className="mt-0.5 block truncate text-xs text-stone-600">{optionsText}</span>
                  ) : null}
                  {s.note !== '' ? (
                    <span className="mt-0.5 block truncate text-xs text-stone-500">„{s.note}"</span>
                  ) : null}
                  <span className="mt-1 block text-xs text-stone-400">
                    {missing
                      ? 'nicht mehr im Menü'
                      : resolved.status === 'partial'
                        ? 'Gericht geändert · prüfen'
                        : busy
                          ? 'Wird hinzugefügt…'
                          : `zuletzt ${lastOrdered(s.last_ordered_at)}${s.times_ordered > 1 ? ` · ${s.times_ordered}×` : ''}`}
                  </span>
                </span>
                {!missing ? (
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-500 text-base leading-none text-white"
                  >
                    +
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
