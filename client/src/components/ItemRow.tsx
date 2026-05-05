import { useState } from 'react';
import type { FormEvent } from 'react';
import { deleteItem, updateItem } from '../api/items';
import { ApiError } from '../api/client';
import { fmtPrice, parsePrice } from '../lib/price';
import type { Item, ItemOptionSnapshot } from '../types/api';
import type { Profile } from '../hooks/useProfile';
import { useToast } from './Toast';

// Render structured options grouped by group name.
// Example: "Größe: Mittel · Toppings: extra Käse (+€1,00), Salami (+€1,50)"
function renderOptions(options: ItemOptionSnapshot[] | null): string {
  if (!options || options.length === 0) return '';
  const byGroup = new Map<string, ItemOptionSnapshot[]>();
  for (const opt of options) {
    const arr = byGroup.get(opt.group);
    if (arr) arr.push(opt);
    else byGroup.set(opt.group, [opt]);
  }
  const parts: string[] = [];
  for (const [group, opts] of byGroup) {
    const names = opts
      .map((o) => {
        if (o.delta_cents === 0) return o.name;
        const sign = o.delta_cents > 0 ? '+' : '−';
        return `${o.name} (${sign}${fmtPrice(Math.abs(o.delta_cents))})`;
      })
      .join(', ');
    parts.push(`${group}: ${names}`);
  }
  return parts.join(' · ');
}

export interface ItemRowProps {
  item: Item;
  sessionId: string;
  profile: Profile;
  sessionOpen: boolean;
  onChanged: (item: Item) => void;
  onDeleted: (itemId: string) => void;
}

export function ItemRow({
  item,
  sessionId,
  profile,
  sessionOpen,
  onChanged,
  onDeleted,
}: ItemRowProps) {
  const [editing, setEditing] = useState<boolean>(false);
  const [dish, setDish] = useState<string>(item.dish);
  const [note, setNote] = useState<string>(item.note);
  const [price, setPrice] = useState<string>(
    item.price_cents === null ? '' : (item.price_cents / 100).toFixed(2).replace('.', ','),
  );
  const [errors, setErrors] = useState<{ dish?: string; price?: string }>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const { showError } = useToast();

  const isOwner = item.user_id === profile.user_id;
  const isStructured = item.dish_id !== null;
  const canEdit = isOwner && sessionOpen && !isStructured;

  function startEdit(): void {
    setDish(item.dish);
    setNote(item.note);
    setPrice(
      item.price_cents === null ? '' : (item.price_cents / 100).toFixed(2).replace('.', ','),
    );
    setErrors({});
    setEditing(true);
  }

  function cancelEdit(): void {
    setEditing(false);
    setErrors({});
  }

  async function handleSave(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const trimmedDish = dish.trim();
    const trimmedNote = note.trim();
    const next: { dish?: string; price?: string } = {};

    if (trimmedDish.length === 0) next.dish = 'Bitte ein Gericht eingeben.';
    else if (trimmedDish.length > 200) next.dish = 'Zu lang (max. 200 Zeichen).';

    let priceCents: number | null = null;
    if (price.trim().length > 0) {
      const parsed = parsePrice(price);
      if (parsed === null || parsed < 0) next.price = 'Ungültiger Preis.';
      else priceCents = parsed;
    }

    if (next.dish || next.price) {
      setErrors(next);
      return;
    }
    setErrors({});

    setBusy(true);
    try {
      const updated = await updateItem(sessionId, item.id, {
        user_id: profile.user_id,
        dish: trimmedDish,
        note: trimmedNote,
        price_cents: priceCents,
      });
      onChanged(updated);
      setEditing(false);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    setBusy(true);
    try {
      await deleteItem(sessionId, item.id, { user_id: profile.user_id });
      onDeleted(item.id);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.');
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-200">
        <form onSubmit={handleSave} className="space-y-2" noValidate>
          <input
            type="text"
            value={dish}
            onChange={(e) => setDish(e.target.value)}
            maxLength={200}
            className="input"
            aria-invalid={errors.dish ? 'true' : 'false'}
            aria-label="Gericht"
          />
          {errors.dish && (
            <p className="text-xs text-rose-600" role="alert">
              {errors.dish}
            </p>
          )}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Anmerkung"
            className="input"
            aria-label="Anmerkung"
          />
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Preis"
            className="input"
            aria-invalid={errors.price ? 'true' : 'false'}
            aria-label="Preis"
          />
          {errors.price && (
            <p className="text-xs text-rose-600" role="alert">
              {errors.price}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary flex-1 btn-sm">
              {busy ? 'Speichert…' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={busy}
              className="btn-secondary flex-1 btn-sm"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-stone-200/70 transition hover:ring-stone-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
            <span className="font-semibold text-stone-900">{item.dish}</span>
            {item.price_cents !== null && (
              <span className="tabular-nums text-stone-700">{fmtPrice(item.price_cents)}</span>
            )}
          </p>
          {item.options && item.options.length > 0 && (
            <p className="mt-0.5 text-sm text-stone-600">{renderOptions(item.options)}</p>
          )}
          {item.note && <p className="mt-0.5 text-sm text-stone-600">{item.note}</p>}
          <p className="mt-1 help-xs">{item.user_name}</p>
        </div>
        {canEdit && !confirmingDelete && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={startEdit}
              disabled={busy}
              className="btn-ghost btn-sm"
              aria-label="Bearbeiten"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="btn-danger-soft btn-sm"
              aria-label="Löschen"
            >
              Löschen
            </button>
          </div>
        )}
        {canEdit && confirmingDelete && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-stone-700">Sicher?</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="btn-danger btn-sm"
            >
              Ja
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
              className="btn-secondary btn-sm"
            >
              Nein
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
