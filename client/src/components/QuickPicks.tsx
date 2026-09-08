import { useRef, useState } from 'react';
import { addFreeTextItem, addStructuredItem } from '../api/items';
import { ApiError } from '../api/client';
import { categoryEmoji, dishCategory } from '../lib/dishDisplay';
import { defaultSelection } from '../lib/menuPricing';
import { fmtPrice } from '../lib/price';
import { mergeQuickPicks } from '../lib/quickPicks';
import { formatSnapshotOptions, resolveSuggestion } from '../lib/suggestions';
import type { DishPrefill } from '../lib/suggestions';
import type { Dish, Item, ReorderSuggestion } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { useToast } from './Toast';

export interface QuickPicksProps {
  sessionId: string;
  profile: Profile;
  // Current menu; empty while loading or when the restaurant has no dishes.
  dishes: Dish[];
  suggestions: ReorderSuggestion[];
  favoriteIds: Set<string>;
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

// "Deine Schnellauswahl": favorites (♥) first, then the last orders at this
// restaurant. One tap adds; anything that needs a decision opens the picker.
export function QuickPicks({
  sessionId,
  profile,
  dishes,
  suggestions,
  favoriteIds,
  onAdded,
  onPrefill,
  disabled,
}: QuickPicksProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // Monotonic key so the picker applies each prefill exactly once.
  const prefillSeq = useRef<number>(0);
  const { showError, showInfo } = useToast();

  const picks = mergeQuickPicks(dishes, favoriteIds, suggestions);
  if (picks.length === 0) return null;

  function prefill(dishId: string, optionIds: string[], note: string, quantity: number): void {
    onPrefill({ key: ++prefillSeq.current, dishId, optionIds, note, quantity });
  }

  async function addStructured(key: string, dishId: string, optionIds: string[], note: string, quantity: number, label: string): Promise<void> {
    setBusyKey(key);
    try {
      const item = await addStructuredItem(sessionId, {
        user_id: profile.user_id,
        user_name: profile.user_name,
        dish_id: dishId,
        option_ids: optionIds,
        note,
        quantity,
      });
      onAdded(item);
      showInfo(`${label} hinzugefügt.`);
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === 'INVALID_SELECTION' || err.code === 'INVALID_OPTION' || err.code === 'DISH_NOT_FOUND')
      ) {
        prefill(dishId, optionIds, note, quantity);
        showInfo('Das Gericht hat sich geändert – bitte Auswahl prüfen.');
      } else {
        showError(err instanceof ApiError ? err.message : 'Eintrag fehlgeschlagen.');
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function pickFavorite(dish: Dish): Promise<void> {
    if (dish.option_groups.length === 0) {
      await addStructured(`f:${dish.id}`, dish.id, [], '', 1, dish.name);
      return;
    }
    prefill(dish.id, defaultSelection(dish), '', 1);
  }

  async function pickSuggestion(key: string, s: ReorderSuggestion): Promise<void> {
    const resolved = resolveSuggestion(dishes, s);
    if (resolved.status === 'missing') return;
    if (resolved.status === 'partial') {
      prefill(resolved.dish.id, resolved.optionIds, s.note, s.quantity);
      showInfo('Das Gericht hat sich geändert – bitte Auswahl prüfen.');
      return;
    }
    if (resolved.status === 'freetext') {
      setBusyKey(key);
      try {
        const item = await addFreeTextItem(sessionId, {
          user_id: profile.user_id,
          user_name: profile.user_name,
          dish: s.dish,
          note: s.note,
          price_cents: s.price_cents,
          quantity: s.quantity,
        });
        onAdded(item);
        showInfo(`${s.quantity > 1 ? `${s.quantity}× ` : ''}${s.dish} hinzugefügt.`);
      } catch (err) {
        showError(err instanceof ApiError ? err.message : 'Eintrag fehlgeschlagen.');
      } finally {
        setBusyKey(null);
      }
      return;
    }
    await addStructured(
      key,
      resolved.dish.id,
      resolved.optionIds,
      s.note,
      s.quantity,
      `${s.quantity > 1 ? `${s.quantity}× ` : ''}${s.dish}`,
    );
  }

  const cardClass = (dimmed: boolean) =>
    'flex h-full w-full items-start gap-2 rounded-xl bg-white p-3 text-left shadow-sm ring-1 transition ' +
    (dimmed ? 'cursor-not-allowed opacity-60 ring-stone-200' : 'ring-stone-200 hover:ring-orange-300 disabled:opacity-60');

  return (
    <div className="card-pad">
      <h4 className="h-card mb-2">Deine Schnellauswahl</h4>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((pick, index) => {
          if (pick.kind === 'favorite') {
            const d = pick.dish;
            const key = `f:${d.id}`;
            const busy = busyKey === key;
            const needsChoice = d.option_groups.length > 0;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => void pickFavorite(d)}
                  disabled={disabled || busy}
                  className={cardClass(false)}
                  aria-label={`${d.name} (Favorit) hinzufügen`}
                >
                  <span aria-hidden="true" className="text-lg leading-none text-rose-500">
                    ♥
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-stone-900">{d.name}</span>
                      <span className="shrink-0 text-sm font-semibold text-stone-800 tabular-nums">
                        {needsChoice ? `ab ${fmtPrice(d.base_price_cents)}` : fmtPrice(d.base_price_cents)}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-stone-400">
                      {busy ? 'Wird hinzugefügt…' : needsChoice ? 'Favorit · Optionen wählen' : 'Favorit'}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-500 text-base leading-none text-white"
                  >
                    +
                  </span>
                </button>
              </li>
            );
          }

          const s = pick.suggestion;
          const key = `s:${s.dish_id ?? s.dish}-${index}`;
          const resolved = resolveSuggestion(dishes, s);
          const missing = resolved.status === 'missing';
          const currentDish =
            resolved.status === 'exact' || resolved.status === 'partial' ? resolved.dish : null;
          const emoji = currentDish ? categoryEmoji(dishCategory(currentDish)) : '🍽️';
          const unit =
            resolved.status === 'exact' || resolved.status === 'partial'
              ? resolved.priceCents
              : s.price_cents;
          const optionsText = formatSnapshotOptions(s.options);
          const busy = busyKey === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => void pickSuggestion(key, s)}
                disabled={disabled || missing || busy}
                className={cardClass(missing)}
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
                    <span className="mt-0.5 block truncate text-xs text-stone-500">„{s.note}“</span>
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
