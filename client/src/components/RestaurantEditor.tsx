import { useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  deleteRestaurant,
  renameRestaurant,
  replaceMenu,
} from '../api/restaurants';
import { useOptionTemplates } from '../hooks/useOptionTemplates';
import { useRestaurant } from '../hooks/useRestaurant';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { generateId } from '../lib/ids';
import { fmtPrice } from '../lib/price';
import type {
  CreateOptionTemplateInput,
  Dish,
  MenuDishInput,
  MenuOptionGroupInput,
  MenuOptionInput,
  Restaurant,
} from '../types/api';
import { DishEditor } from './DishEditor';
import { ProfileMenu } from './ProfileMenu';
import { DuePill } from './DuePill';
import { DragHandle, SortableItem, SortableList } from './Sortable';
import { useErrorToast, useToast } from './Toast';
import { WorkspaceLink, useWorkspaceNavigate } from './WorkspaceLink';

// Local invariant: every editor item carries an id (server-assigned for
// loaded items, client-generated for newly added ones). The id powers React
// keys, drag-and-drop identity, and per-id collapsed state.
type DishInput = MenuDishInput & { id: string };

function dishToInput(dish: Dish): DishInput {
  return {
    id: dish.id,
    name: dish.name,
    category: dish.category,
    description: dish.description,
    base_price_cents: dish.base_price_cents,
    is_vegetarian: dish.is_vegetarian,
    option_groups: dish.option_groups.map<MenuOptionGroupInput>((g) => ({
      id: g.id,
      name: g.name,
      selection_type: g.selection_type,
      max_select: g.max_select,
      options: g.options.map<MenuOptionInput>((o) => ({
        id: o.id,
        name: o.name,
        price_delta_cents: o.price_delta_cents,
      })),
    })),
  };
}

function emptyDish(): DishInput {
  return {
    id: generateId(),
    name: '',
    category: '',
    description: '',
    base_price_cents: 0,
    is_vegetarian: false,
    option_groups: [],
  };
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

// Strip client-only ids before sending to the server. The server creates its
// own ids for everything; sending temp client ids would just be ignored.
function trimMenu(dishes: MenuDishInput[]): MenuDishInput[] {
  return dishes.map((d) => ({
    name: d.name.trim(),
    category: (d.category ?? '').trim(),
    description: (d.description ?? '').trim(),
    base_price_cents: d.base_price_cents,
    is_vegetarian: d.is_vegetarian ?? false,
    option_groups: d.option_groups.map((g) => ({
      name: g.name.trim(),
      selection_type: g.selection_type,
      max_select: g.selection_type === 'multi' ? (g.max_select ?? null) : null,
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
  const {
    templates,
    create: createTemplate,
    remove: removeTemplate,
  } = useOptionTemplates();

  async function handleSaveTemplate(input: CreateOptionTemplateInput): Promise<void> {
    try {
      await createTemplate(input);
      showInfo('Template gespeichert.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Template-Speichern fehlgeschlagen.');
      throw err;
    }
  }

  async function handleDeleteTemplate(id: string): Promise<void> {
    try {
      await removeTemplate(id);
      showInfo('Template gelöscht.');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Template-Löschen fehlgeschlagen.');
    }
  }

  // Whenever the loaded restaurant changes (e.g. after a save), re-seed the
  // local editor state. We use React 19's "compare during render" pattern
  // and identity-track the restaurant by reference.
  const [trackedRestaurant, setTrackedRestaurant] = useState<Restaurant | null>(restaurant);
  const seedDishes = (r: Restaurant | null): DishInput[] =>
    r ? r.dishes.map(dishToInput) : [];
  const seedSnapshot = (r: Restaurant | null, dishesIn: DishInput[]): string =>
    JSON.stringify({ name: r?.name ?? '', dishes: dishesIn });

  const [name, setName] = useState<string>(restaurant?.name ?? '');
  const [dishes, setDishes] = useState<DishInput[]>(() => seedDishes(restaurant));
  const [originalSnapshot, setOriginalSnapshot] = useState<string>(() =>
    seedSnapshot(restaurant, seedDishes(restaurant)),
  );
  // Collapsed state is keyed by dish id (not array index) so it survives
  // reordering. Default-collapse all loaded dishes when the restaurant has
  // more than one, so the editor stays compact on load.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    const initial = seedDishes(restaurant);
    return initial.length > 1 ? new Set(initial.map((d) => d.id)) : new Set();
  });

  if (trackedRestaurant !== restaurant) {
    setTrackedRestaurant(restaurant);
    if (restaurant) {
      const seeded = seedDishes(restaurant);
      setName(restaurant.name);
      setDishes(seeded);
      setOriginalSnapshot(seedSnapshot(restaurant, seeded));
      setCollapsedIds(seeded.length > 1 ? new Set(seeded.map((d) => d.id)) : new Set());
    }
  }

  const [saving, setSaving] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  // Desktop: dish list on the left, one dish editor on the right.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);

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

  function updateDish(id: string, next: DishInput): void {
    setDishes((current) => current.map((d) => (d.id === id ? next : d)));
  }

  function removeDish(id: string): void {
    setDishes((current) => current.filter((d) => d.id !== id));
    setCollapsedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function addDish(): void {
    const fresh = emptyDish();
    setDishes((current) => [...current, fresh]);
    // New dishes always start expanded so the user can fill them in; on
    // desktop they become the selected dish.
    setSelectedDishId(fresh.id);
  }

  function toggleCollapsed(id: string): void {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allCollapsed = dishes.length > 0 && dishes.every((d) => collapsedIds.has(d.id));
  function toggleAll(): void {
    setCollapsedIds(allCollapsed ? new Set() : new Set(dishes.map((d) => d.id)));
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

  // Desktop selection falls back to the first dish (also after a removal).
  const selectedDish: DishInput | null =
    dishes.find((d) => d.id === selectedDishId) ?? dishes[0] ?? null;

  const nameCard = (
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
  );

  return (
    <div className="page pb-24">
      <header className="app-header">
        <div className="app-header-inner">
          <WorkspaceLink to="/restaurants" className="btn-link">
            ← Restaurants
          </WorkspaceLink>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
            <DuePill />
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

      {isDesktop ? (
      <form onSubmit={handleSave} className="page-container-wide" noValidate>
        <div className="layout-2col-left">
          <aside className="layout-side">
            {nameCard}

            <section className="card-pad space-y-3">
              <h2 className="h-card">
                {dishes.length} {dishes.length === 1 ? 'Gericht' : 'Gerichte'}
              </h2>
              {dishes.length === 0 ? (
                <p className="help-xs">Noch keine Gerichte.</p>
              ) : (
                <SortableList items={dishes} onReorder={setDishes}>
                  <ul className="space-y-1">
                    {dishes.map((d) => {
                      const selected = selectedDish !== null && d.id === selectedDish.id;
                      const displayName = d.name.trim() === '' ? 'Unbenanntes Gericht' : d.name;
                      return (
                        <SortableItem key={d.id} id={d.id}>
                          {({ dragHandleProps }) => (
                            <li
                              className={
                                'flex items-center gap-1 rounded-lg px-1 py-1 transition ' +
                                (selected ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-stone-50')
                              }
                            >
                              <DragHandle handleProps={dragHandleProps} label="Gericht verschieben" />
                              <button
                                type="button"
                                onClick={() => setSelectedDishId(d.id)}
                                aria-current={selected ? 'true' : undefined}
                                className="flex min-w-0 flex-1 items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-sm"
                              >
                                <span
                                  className={
                                    'truncate font-medium ' +
                                    (d.name.trim() === '' ? 'text-stone-400' : 'text-stone-900')
                                  }
                                >
                                  {displayName}
                                </span>
                                {d.is_vegetarian ? (
                                  <span className="shrink-0" aria-label="Vegetarisch">
                                    🌱
                                  </span>
                                ) : null}
                                <span className="ml-auto shrink-0 text-xs text-stone-500 tabular-nums">
                                  {fmtPrice(d.base_price_cents)}
                                </span>
                              </button>
                            </li>
                          )}
                        </SortableItem>
                      );
                    })}
                  </ul>
                </SortableList>
              )}
              <button type="button" onClick={addDish} className="btn-dashed w-full">
                + Gericht hinzufügen
              </button>
            </section>

            <div className="card flex items-center justify-between gap-3 px-4 py-3">
              <span className="help-xs">
                {dirty ? 'Ungespeicherte Änderungen.' : 'Alles gespeichert.'}
              </span>
              <button type="submit" disabled={saving || !dirty} className="btn-primary">
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </aside>

          <div className="layout-main">
            {selectedDish ? (
              <DishEditor
                key={selectedDish.id}
                dish={selectedDish}
                collapsed={false}
                onToggleCollapsed={() => undefined}
                onChange={(next) => updateDish(selectedDish.id, { ...next, id: selectedDish.id })}
                onRemove={() => removeDish(selectedDish.id)}
                templates={templates}
                onSaveAsTemplate={handleSaveTemplate}
                onDeleteTemplate={handleDeleteTemplate}
              />
            ) : (
              <div className="empty">
                Noch keine Gerichte. Klick „+ Gericht hinzufügen", um eines anzulegen.
              </div>
            )}
          </div>
        </div>
      </form>
      ) : (
      <form onSubmit={handleSave} className="page-container-wide space-y-5" noValidate>
        {nameCard}

        <section className="space-y-3">
          {dishes.length > 1 ? (
            <div className="flex items-center justify-between">
              <h2 className="h-card">
                {dishes.length} {dishes.length === 1 ? 'Gericht' : 'Gerichte'}
              </h2>
              <button type="button" onClick={toggleAll} className="btn-link text-xs">
                {allCollapsed ? 'Alle ausklappen' : 'Alle einklappen'}
              </button>
            </div>
          ) : null}

          {dishes.length === 0 ? (
            <div className="empty">
              Noch keine Gerichte. Klick „+ Gericht hinzufügen", um eines anzulegen.
            </div>
          ) : (
            <SortableList items={dishes} onReorder={setDishes}>
              <div className="space-y-3">
                {dishes.map((d) => (
                  <SortableItem key={d.id} id={d.id}>
                    {({ dragHandleProps }) => (
                      <DishEditor
                        dish={d}
                        collapsed={collapsedIds.has(d.id)}
                        onToggleCollapsed={() => toggleCollapsed(d.id)}
                        onChange={(next) => updateDish(d.id, { ...next, id: d.id })}
                        onRemove={() => removeDish(d.id)}
                        templates={templates}
                        onSaveAsTemplate={handleSaveTemplate}
                        onDeleteTemplate={handleDeleteTemplate}
                        dragHandleProps={dragHandleProps}
                      />
                    )}
                  </SortableItem>
                ))}
              </div>
            </SortableList>
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
      )}
    </div>
  );
}

