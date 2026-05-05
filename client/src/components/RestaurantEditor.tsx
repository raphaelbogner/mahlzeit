import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  deleteRestaurant,
  renameRestaurant,
  replaceMenu,
} from '../api/restaurants';
import { useRestaurant } from '../hooks/useRestaurant';
import type {
  Dish,
  MenuDishInput,
  MenuOptionGroupInput,
  MenuOptionInput,
  Restaurant,
} from '../types/api';
import { DishEditor } from './DishEditor';
import { ProfileMenu } from './ProfileMenu';
import { useErrorToast, useToast } from './Toast';
import { WorkspaceLink, useWorkspaceNavigate } from './WorkspaceLink';

function dishToInput(dish: Dish): MenuDishInput {
  return {
    id: dish.id,
    name: dish.name,
    base_price_cents: dish.base_price_cents,
    option_groups: dish.option_groups.map<MenuOptionGroupInput>((g) => ({
      id: g.id,
      name: g.name,
      selection_type: g.selection_type,
      options: g.options.map<MenuOptionInput>((o) => ({
        id: o.id,
        name: o.name,
        price_delta_cents: o.price_delta_cents,
      })),
    })),
  };
}

function emptyDish(): MenuDishInput {
  return { name: '', base_price_cents: 0, option_groups: [] };
}

interface ValidationError {
  message: string;
}

function validate(dishes: MenuDishInput[]): ValidationError | null {
  if (dishes.length === 0) return null;
  for (let di = 0; di < dishes.length; di++) {
    const d = dishes[di]!;
    const dishLabel = `Gericht ${di + 1}`;
    if (d.name.trim() === '') {
      return { message: `${dishLabel}: Name fehlt.` };
    }
    if (d.base_price_cents < 0) {
      return { message: `${dishLabel}: Basispreis darf nicht negativ sein.` };
    }
    for (let gi = 0; gi < d.option_groups.length; gi++) {
      const g = d.option_groups[gi]!;
      const groupLabel = `${dishLabel} → Gruppe ${gi + 1}`;
      if (g.name.trim() === '') {
        return { message: `${groupLabel}: Name fehlt.` };
      }
      if (g.options.length === 0) {
        return { message: `${groupLabel}: braucht mindestens eine Option.` };
      }
      for (let oi = 0; oi < g.options.length; oi++) {
        const o = g.options[oi]!;
        if (o.name.trim() === '') {
          return { message: `${groupLabel} → Option ${oi + 1}: Name fehlt.` };
        }
      }
    }
  }
  return null;
}

function trimMenu(dishes: MenuDishInput[]): MenuDishInput[] {
  return dishes.map((d) => ({
    name: d.name.trim(),
    base_price_cents: d.base_price_cents,
    option_groups: d.option_groups.map((g) => ({
      name: g.name.trim(),
      selection_type: g.selection_type,
      options: g.options.map((o) => ({
        name: o.name.trim(),
        price_delta_cents: o.price_delta_cents,
      })),
    })),
  }));
}

export function RestaurantEditor() {
  const params = useParams<{ id: string }>();
  const navigate = useWorkspaceNavigate();
  const { restaurant, loading, error, setRestaurant } = useRestaurant(params.id);
  useErrorToast(error);
  const { showError, showInfo } = useToast();

  // Whenever the loaded restaurant changes (e.g. after a save), re-seed the
  // local editor state. We use React 19's "compare during render" pattern
  // and identity-track the restaurant by reference.
  const [trackedRestaurant, setTrackedRestaurant] = useState<Restaurant | null>(restaurant);
  const seedDishes = (r: Restaurant | null): MenuDishInput[] =>
    r ? r.dishes.map(dishToInput) : [];
  const seedSnapshot = (r: Restaurant | null, dishesIn: MenuDishInput[]): string =>
    JSON.stringify({ name: r?.name ?? '', dishes: dishesIn });

  const [name, setName] = useState<string>(restaurant?.name ?? '');
  const [dishes, setDishes] = useState<MenuDishInput[]>(() => seedDishes(restaurant));
  const [originalSnapshot, setOriginalSnapshot] = useState<string>(() =>
    seedSnapshot(restaurant, seedDishes(restaurant)),
  );

  if (trackedRestaurant !== restaurant) {
    setTrackedRestaurant(restaurant);
    if (restaurant) {
      const seeded = seedDishes(restaurant);
      setName(restaurant.name);
      setDishes(seeded);
      setOriginalSnapshot(seedSnapshot(restaurant, seeded));
    }
  }

  const [saving, setSaving] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);

  if (loading && !restaurant) {
    return (
      <div className="page">
        <div className="page-container-wide space-y-4" aria-busy="true">
          <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
          <div className="h-9 w-full animate-pulse rounded bg-stone-200" />
          <div className="h-32 animate-pulse rounded-2xl bg-stone-100" />
          <div className="h-32 animate-pulse rounded-2xl bg-stone-100" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="page">
        <div className="page-container-wide">
          <p className="help">Restaurant nicht gefunden.</p>
        </div>
      </div>
    );
  }

  const dirty = JSON.stringify({ name, dishes }) !== originalSnapshot;

  function updateDish(idx: number, next: MenuDishInput): void {
    setDishes((current) => current.map((d, i) => (i === idx ? next : d)));
  }

  function removeDish(idx: number): void {
    setDishes((current) => current.filter((_, i) => i !== idx));
  }

  function addDish(): void {
    setDishes((current) => [...current, emptyDish()]);
  }

  async function handleSave(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!restaurant) return;

    const trimmedName = name.trim();
    if (trimmedName === '') {
      showError('Name darf nicht leer sein.');
      return;
    }

    const cleanedDishes = trimMenu(dishes);
    const ve = validate(cleanedDishes);
    if (ve) {
      showError(ve.message);
      return;
    }

    setSaving(true);
    try {
      let updated: Restaurant = restaurant;
      if (trimmedName !== restaurant.name) {
        updated = await renameRestaurant(restaurant.id, trimmedName);
      }
      updated = await replaceMenu(restaurant.id, { dishes: cleanedDishes });
      setRestaurant(updated);
      showInfo('Gespeichert.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!restaurant) return;
    setSaving(true);
    try {
      await deleteRestaurant(restaurant.id);
      navigate('/restaurants');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.');
      setSaving(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="page pb-24">
      <header className="app-header">
        <div className="app-header-inner">
          <WorkspaceLink to="/restaurants" className="btn-link">
            ← Restaurants
          </WorkspaceLink>
          <div className="flex items-center gap-3">
            <ProfileMenu />
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                className="btn-danger-soft btn-sm"
              >
                Restaurant löschen
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-stone-700">Sicher löschen?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="btn-danger btn-sm"
                >
                  Ja, löschen
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={saving}
                  className="btn-secondary btn-sm"
                >
                  Nein
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <form onSubmit={handleSave} className="page-container-wide space-y-5" noValidate>
        <div className="card-pad">
          <label htmlFor="restaurant-name" className="label">
            Restaurant-Name
          </label>
          <input
            id="restaurant-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            className="input text-lg font-semibold"
          />
        </div>

        <section className="space-y-3">
          {dishes.length === 0 ? (
            <div className="empty">
              Noch keine Gerichte. Klick „+ Gericht hinzufügen", um eines anzulegen.
            </div>
          ) : (
            dishes.map((d, idx) => (
              <DishEditor
                key={idx}
                dish={d}
                onChange={(next) => updateDish(idx, next)}
                onRemove={() => removeDish(idx)}
              />
            ))
          )}

          <button type="button" onClick={addDish} className="btn-dashed w-full">
            + Gericht hinzufügen
          </button>
        </section>

        <div className="sticky bottom-0 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-stone-200/80 bg-white/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <span className="help-xs">
            {dirty ? 'Ungespeicherte Änderungen.' : 'Alles gespeichert.'}
          </span>
          <button type="submit" disabled={saving || !dirty} className="btn-primary">
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
