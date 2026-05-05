import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../api/client';
import { createRestaurant } from '../api/restaurants';
import { useRestaurants } from '../hooks/useRestaurants';
import { useErrorToast, useToast } from './Toast';
import { WorkspaceLink, useWorkspaceNavigate } from './WorkspaceLink';

export function RestaurantList() {
  const navigate = useWorkspaceNavigate();
  const { restaurants, loading, error } = useRestaurants();
  useErrorToast(error);

  const [creating, setCreating] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { showError } = useToast();

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setCreateError('Bitte einen Namen eingeben.');
      return;
    }
    if (trimmed.length > 200) {
      setCreateError('Zu lang (max. 200 Zeichen).');
      return;
    }
    setCreateError(null);
    setSubmitting(true);
    try {
      const restaurant = await createRestaurant(trimmed);
      setName('');
      setCreating(false);
      navigate(`/restaurants/${restaurant.id}`);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Restaurant konnte nicht angelegt werden.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4">
        <WorkspaceLink to="/" className="text-sm text-blue-600 hover:underline">
          ← Zurück zu Sammelbestellungen
        </WorkspaceLink>
      </div>

      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold sm:text-2xl">Restaurants</h1>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Neu
          </button>
        )}
      </header>

      {creating && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 space-y-2 rounded border border-gray-200 bg-white p-3"
          noValidate
        >
          <label htmlFor="new-restaurant-name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="new-restaurant-name"
            type="text"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="z. B. Pizzeria Roma"
            className="w-full rounded border border-gray-300 px-3 py-2"
            aria-invalid={createError ? 'true' : 'false'}
          />
          {createError && (
            <p className="text-sm text-red-600" role="alert">
              {createError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Wird angelegt…' : 'Anlegen'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setName('');
                setCreateError(null);
              }}
              disabled={submitting}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {loading && restaurants.length === 0 ? (
        <ul className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-14 animate-pulse rounded border border-gray-200 bg-gray-50"
            />
          ))}
        </ul>
      ) : restaurants.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
          Noch keine Restaurants. Klick „+ Neu", um eines anzulegen.
        </div>
      ) : (
        <ul className="space-y-2">
          {restaurants.map((r) => (
            <li
              key={r.id}
              className="rounded border border-gray-200 bg-white transition hover:border-blue-400"
            >
              <WorkspaceLink to={`/restaurants/${r.id}`} className="block p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="shrink-0 text-xs text-gray-500">
                    {r.dish_count} {r.dish_count === 1 ? 'Gericht' : 'Gerichte'}
                  </p>
                </div>
              </WorkspaceLink>
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}
