import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../api/client';
import { createRestaurant } from '../api/restaurants';
import { useRestaurants } from '../hooks/useRestaurants';
import { ProfileMenu } from './ProfileMenu';
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
    <div className="page">
      <header className="app-header">
        <div className="app-header-inner">
          <WorkspaceLink to="/" className="btn-link">
            ← Sammelbestellungen
          </WorkspaceLink>
          <div className="flex items-center gap-3">
            <ProfileMenu />
            {!creating && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="btn-primary btn-sm"
              >
                + Neues Restaurant
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="page-container space-y-5">
        <div>
          <h1 className="h-page">Restaurants</h1>
          <p className="mt-1 help">Speisekarten für die strukturierte Bestellung.</p>
        </div>

        {creating && (
          <form onSubmit={handleSubmit} className="card-pad space-y-3" noValidate>
            <label htmlFor="new-restaurant-name" className="label">
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
              className="input"
              aria-invalid={createError ? 'true' : 'false'}
            />
            {createError && (
              <p className="field-error" role="alert">
                {createError}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary">
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
                className="btn-secondary"
              >
                Abbrechen
              </button>
            </div>
          </form>
        )}

        {loading && restaurants.length === 0 ? (
          <ul className="space-y-2.5" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-14 animate-pulse rounded-2xl bg-white ring-1 ring-stone-200/70"
              />
            ))}
          </ul>
        ) : restaurants.length === 0 ? (
          <div className="empty">
            Noch keine Restaurants. Klick auf{' '}
            <span className="font-medium text-stone-800">„+ Neues Restaurant"</span>, um eines
            anzulegen.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {restaurants.map((r) => (
              <li
                key={r.id}
                className="card transition hover:-translate-y-0.5 hover:shadow-pop hover:ring-orange-300"
              >
                <WorkspaceLink to={`/restaurants/${r.id}`} className="block p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-semibold text-stone-900">{r.name}</p>
                    <p className="shrink-0 help-xs tabular-nums">
                      {r.dish_count} {r.dish_count === 1 ? 'Gericht' : 'Gerichte'}
                    </p>
                  </div>
                </WorkspaceLink>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
