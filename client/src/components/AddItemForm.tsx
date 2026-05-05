import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { addFreeTextItem } from '../api/items';
import { ApiError } from '../api/client';
import { getRestaurant } from '../api/restaurants';
import { fmtPrice, parsePrice } from '../lib/price';
import type { Dish, Item } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { DishPicker } from './DishPicker';
import { useToast } from './Toast';

export interface AddItemFormProps {
  sessionId: string;
  restaurantId: string | null;
  profile: Profile;
  onAdded: (item: Item) => void;
  disabled?: boolean;
}

export function AddItemForm({
  sessionId,
  restaurantId,
  profile,
  onAdded,
  disabled,
}: AddItemFormProps) {
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [menuLoading, setMenuLoading] = useState<boolean>(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [forceFreitext, setForceFreitext] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      if (!restaurantId) {
        setDishes(null);
        setMenuError(null);
        return;
      }
      setMenuLoading(true);
      setMenuError(null);
      try {
        const r = await getRestaurant(restaurantId, controller.signal);
        if (cancelled) return;
        setDishes(r.dishes);
      } catch (e: unknown) {
        if (cancelled) return;
        setMenuError(e instanceof ApiError ? e.message : 'Menü konnte nicht geladen werden.');
      } finally {
        if (!cancelled) setMenuLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [restaurantId]);

  const showPicker =
    !forceFreitext && restaurantId !== null && dishes !== null && dishes.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-base font-medium">Eintrag hinzufügen</h3>

      {restaurantId !== null && menuLoading && (
        <div
          className="space-y-3 rounded border border-gray-200 bg-white p-4"
          aria-busy="true"
          aria-label="Menü wird geladen"
        >
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-6 w-2/3 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      )}

      {restaurantId !== null && menuError && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {menuError}
        </div>
      )}

      {showPicker ? (
        <DishPicker
          sessionId={sessionId}
          dishes={dishes!}
          profile={profile}
          onAdded={(item) => {
            onAdded(item);
          }}
          disabled={disabled}
        />
      ) : (
        <FreitextItemForm
          sessionId={sessionId}
          profile={profile}
          onAdded={onAdded}
          disabled={disabled}
        />
      )}

      {restaurantId !== null && dishes && dishes.length > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setForceFreitext((v) => !v)}
            className="text-xs text-blue-600 hover:underline"
          >
            {forceFreitext ? '← zurück zur Auswahl' : '— oder Freitext eingeben —'}
          </button>
        </div>
      )}
    </div>
  );
}

interface FreitextItemFormProps {
  sessionId: string;
  profile: Profile;
  onAdded: (item: Item) => void;
  disabled?: boolean;
}

function FreitextItemForm({ sessionId, profile, onAdded, disabled }: FreitextItemFormProps) {
  const [dish, setDish] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [errors, setErrors] = useState<{ dish?: string; price?: string }>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { showError } = useToast();

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (disabled) return;

    const trimmedDish = dish.trim();
    const trimmedNote = note.trim();
    const next: { dish?: string; price?: string } = {};

    if (trimmedDish.length === 0) {
      next.dish = 'Bitte ein Gericht eingeben.';
    } else if (trimmedDish.length > 200) {
      next.dish = 'Zu lang (max. 200 Zeichen).';
    }

    let priceCents: number | null = null;
    if (price.trim().length > 0) {
      const parsed = parsePrice(price);
      if (parsed === null || parsed < 0) {
        next.price = 'Ungültiger Preis.';
      } else {
        priceCents = parsed;
      }
    }

    if (next.dish || next.price) {
      setErrors(next);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const item = await addFreeTextItem(sessionId, {
        user_id: profile.user_id,
        user_name: profile.user_name,
        dish: trimmedDish,
        note: trimmedNote,
        price_cents: priceCents,
      });
      onAdded(item);
      setDish('');
      setNote('');
      setPrice('');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Eintrag fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded border border-gray-200 bg-white p-4"
      noValidate
    >
      <div>
        <label htmlFor="dish" className="mb-1 block text-sm font-medium">
          Gericht
        </label>
        <input
          id="dish"
          type="text"
          value={dish}
          onChange={(e) => setDish(e.target.value)}
          maxLength={200}
          placeholder="z. B. Margherita"
          disabled={disabled || submitting}
          className="w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100"
          aria-invalid={errors.dish ? 'true' : 'false'}
        />
        {errors.dish && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.dish}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="note" className="mb-1 block text-sm font-medium">
          Anmerkung <span className="text-gray-500">(optional)</span>
        </label>
        <input
          id="note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          placeholder="z. B. ohne Knoblauch"
          disabled={disabled || submitting}
          className="w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100"
        />
      </div>

      <div>
        <label htmlFor="price" className="mb-1 block text-sm font-medium">
          Preis <span className="text-gray-500">(optional)</span>
        </label>
        <input
          id="price"
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="z. B. 9,50"
          disabled={disabled || submitting}
          className="w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100"
          aria-invalid={errors.price ? 'true' : 'false'}
        />
        {errors.price && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.price}
          </p>
        )}
        {price.trim() && !errors.price && parsePrice(price) !== null && (
          <p className="mt-1 text-xs text-gray-500">{fmtPrice(parsePrice(price)!)}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={disabled || submitting}
        className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Wird hinzugefügt…' : 'Hinzufügen'}
      </button>
    </form>
  );
}
