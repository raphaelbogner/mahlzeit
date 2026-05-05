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
        'w-28 rounded border px-2 py-1 text-right ' +
        (valid ? 'border-gray-300' : 'border-red-400')
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
    <div className="rounded border border-gray-300 bg-white p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={dish.name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="Name des Gerichts"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-base font-medium"
          aria-label="Gerichtsname"
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
        >
          Gericht entfernen
        </button>
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm">
        <label className="text-gray-700" htmlFor={`base-${dish.id ?? dish.name}`}>
          Basispreis €:
        </label>
        <DishPriceInput value={dish.base_price_cents} onCommit={setBasePrice} />
        <span className="text-xs text-gray-500">{fmtPrice(dish.base_price_cents)}</span>
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

      <button
        type="button"
        onClick={addGroup}
        className="mt-2 rounded border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
      >
        + Optionsgruppe hinzufügen
      </button>
    </div>
  );
}
