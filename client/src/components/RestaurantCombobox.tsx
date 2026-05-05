import { useId, useMemo, useState } from 'react';
import type { RestaurantSummary } from '../types/api';

export interface RestaurantSelection {
  restaurant_id: string | null;
  restaurant_name: string;
}

export interface RestaurantComboboxProps {
  restaurants: RestaurantSummary[];
  value: RestaurantSelection;
  onChange: (next: RestaurantSelection) => void;
  disabled?: boolean;
  id?: string;
}

// Text input with a simple filtered dropdown of existing restaurants.
// The selection model is normalized: any case-insensitive exact match
// against the typed name produces a linked selection (with restaurant_id);
// otherwise the typed text is kept as freitext (restaurant_id = null).
export function RestaurantCombobox({
  restaurants,
  value,
  onChange,
  disabled,
  id,
}: RestaurantComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [open, setOpen] = useState<boolean>(false);

  const matches = useMemo(() => {
    const q = value.restaurant_name.trim().toLowerCase();
    if (q === '') return restaurants;
    return restaurants.filter((r) => r.name.toLowerCase().includes(q));
  }, [restaurants, value.restaurant_name]);

  function commitText(text: string): void {
    const trimmed = text.trim();
    const linked = restaurants.find((r) => r.name.toLowerCase() === trimmed.toLowerCase());
    onChange({
      restaurant_id: linked ? linked.id : null,
      restaurant_name: linked ? linked.name : text,
    });
  }

  function pick(r: RestaurantSummary): void {
    onChange({ restaurant_id: r.id, restaurant_name: r.name });
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${inputId}-listbox`}
        autoComplete="off"
        spellCheck={false}
        value={value.restaurant_name}
        onChange={(e) => commitText(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        disabled={disabled}
        maxLength={200}
        placeholder="z. B. Pizzeria Roma"
        className="w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100"
      />
      {value.restaurant_id !== null && (
        <p className="mt-1 text-xs text-green-700">
          ✓ Verknüpft mit bestehendem Restaurant
        </p>
      )}
      {open && matches.length > 0 && (
        <ul
          id={`${inputId}-listbox`}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg"
        >
          {matches.map((r) => (
            <li
              key={r.id}
              role="option"
              aria-selected={r.id === value.restaurant_id}
              className={
                'cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 ' +
                (r.id === value.restaurant_id ? 'bg-blue-100' : '')
              }
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
            >
              {r.name}
              <span className="ml-2 text-xs text-gray-500">
                {r.dish_count} {r.dish_count === 1 ? 'Gericht' : 'Gerichte'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
