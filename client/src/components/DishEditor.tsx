import { useState } from 'react';
import { fmtPrice, parsePrice } from '../lib/price';
import type { MenuDishInput, MenuOptionGroupInput } from '../types/api';
import { OptionGroupEditor } from './OptionGroupEditor';

export interface DishEditorProps {
  dish: MenuDishInput;
  onChange: (next: MenuDishInput) => void;
  onRemove: () => void;
}

function emptyGroup(): MenuOptionGroupInput {
  return {
    name: '',
    selection_type: 'single',
    options: [{ name: '', price_delta_cents: 0 }],
  };
}

interface DishPriceInputProps {
  value: number;
  onCommit: (next: number) => void;
}

function DishPriceInput({ value, onCommit }: DishPriceInputProps) {
  const initial = (value / 100).toFixed(2).replace('.', ',');
  const [buf, setBuf] = useState<string>(value === 0 ? '' : initial);
  const [valid, setValid] = useState<boolean>(true);

  function commit(): void {
    const trimmed = buf.trim();
    if (trimmed === '') {
      setValid(true);
      setBuf('');
      if (value !== 0) onCommit(0);
      return;
    }
    const parsed = parsePrice(trimmed);
    if (parsed === null || parsed < 0) {
      setValid(false);
      return;
    }
    setValid(true);
    setBuf((parsed / 100).toFixed(2).replace('.', ','));
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={buf}
      onChange={(e) => {
        setBuf(e.target.value);
        const parsed = parsePrice(e.target.value);
        if (parsed !== null && parsed >= 0) {
          setValid(true);
          if (parsed !== value) onCommit(parsed);
        }
      }}
      onBlur={commit}
      placeholder="0,00"
      className={
        'block w-28 rounded-lg bg-white px-3 py-1.5 text-right text-sm text-stone-900 shadow-sm ring-1 transition focus:outline-none focus:ring-2 focus:ring-orange-500 ' +
        (valid ? 'ring-stone-300' : 'ring-rose-400')
      }
      aria-label="Basispreis"
      aria-invalid={!valid}
    />
  );
}

export function DishEditor({ dish, onChange, onRemove }: DishEditorProps) {
  function setName(name: string): void {
    onChange({ ...dish, name });
  }

  function setBasePrice(base_price_cents: number): void {
    onChange({ ...dish, base_price_cents });
  }

  function updateGroup(idx: number, next: MenuOptionGroupInput): void {
    const option_groups = dish.option_groups.map((g, i) => (i === idx ? next : g));
    onChange({ ...dish, option_groups });
  }

  function removeGroup(idx: number): void {
    onChange({
      ...dish,
      option_groups: dish.option_groups.filter((_, i) => i !== idx),
    });
  }

  function addGroup(): void {
    onChange({
      ...dish,
      option_groups: [...dish.option_groups, emptyGroup()],
    });
  }

  return (
    <div className="card-pad">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={dish.name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="Name des Gerichts"
          className="input flex-1 text-base font-semibold"
          aria-label="Gerichtsname"
        />
        <button
          type="button"
          onClick={onRemove}
          className="btn-danger-soft btn-sm"
        >
          Gericht entfernen
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <label className="text-stone-700" htmlFor={`base-${dish.id ?? dish.name}`}>
          Basispreis €:
        </label>
        <DishPriceInput value={dish.base_price_cents} onCommit={setBasePrice} />
        <span className="text-xs text-stone-500 tabular-nums">{fmtPrice(dish.base_price_cents)}</span>
      </div>

      <div className="space-y-2">
        {dish.option_groups.map((group, idx) => (
          <OptionGroupEditor
            key={idx}
            group={group}
            onChange={(next) => updateGroup(idx, next)}
            onRemove={() => removeGroup(idx)}
          />
        ))}
      </div>

      <button type="button" onClick={addGroup} className="btn-dashed btn-sm mt-3">
        + Optionsgruppe hinzufügen
      </button>
    </div>
  );
}
