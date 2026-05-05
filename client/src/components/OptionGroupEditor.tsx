import { useState } from 'react';
import { fmtPrice, parsePrice } from '../lib/price';
import type { MenuOptionGroupInput, MenuOptionInput, SelectionType } from '../types/api';

export interface OptionGroupEditorProps {
  group: MenuOptionGroupInput;
  onChange: (next: MenuOptionGroupInput) => void;
  onRemove: () => void;
}

function emptyOption(): MenuOptionInput {
  return { name: '', price_delta_cents: 0 };
}

function formatDeltaForInput(cents: number): string {
  if (cents === 0) return '';
  const sign = cents > 0 ? '+' : '-';
  return `${sign}${(Math.abs(cents) / 100).toFixed(2).replace('.', ',')}`;
}

// Tries to parse user input like "1,50", "+1,50", "-0,50", "0", "" as a
// signed cent delta. Empty / whitespace yields 0. Returns null on garbage.
function parseDeltaInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/[−–—]/g, '-');
  if (trimmed === '' || trimmed === '+' || trimmed === '-') return 0;
  let sign = 1;
  let body = trimmed;
  if (body.startsWith('+')) body = body.slice(1);
  else if (body.startsWith('-')) {
    sign = -1;
    body = body.slice(1);
  }
  const parsed = parsePrice(body);
  if (parsed === null) return null;
  return sign * parsed;
}

interface OptionDeltaInputProps {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
}

// Local buffer keeps mid-typing strings ("1,") usable; we only commit on
// blur or when the buffer parses cleanly.
function OptionDeltaInput({ value, onCommit, ariaLabel }: OptionDeltaInputProps) {
  const [buf, setBuf] = useState<string>(formatDeltaForInput(value));
  const [valid, setValid] = useState<boolean>(true);

  function commit(): void {
    const parsed = parseDeltaInput(buf);
    if (parsed === null) {
      setValid(false);
      return;
    }
    setValid(true);
    setBuf(formatDeltaForInput(parsed));
    if (parsed !== value) onCommit(parsed);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={buf}
      onChange={(e) => {
        setBuf(e.target.value);
        const parsed = parseDeltaInput(e.target.value);
        if (parsed !== null) {
          setValid(true);
          if (parsed !== value) onCommit(parsed);
        }
      }}
      onBlur={commit}
      placeholder="+0,00"
      className={
        'w-24 rounded border px-2 py-1 text-right ' +
        (valid ? 'border-gray-300' : 'border-red-400')
      }
      aria-label={ariaLabel}
      aria-invalid={!valid}
    />
  );
}

export function OptionGroupEditor({ group, onChange, onRemove }: OptionGroupEditorProps) {
  function setName(name: string): void {
    onChange({ ...group, name });
  }

  function setSelectionType(selection_type: SelectionType): void {
    onChange({ ...group, selection_type });
  }

  function updateOption(idx: number, patch: Partial<MenuOptionInput>): void {
    const options = group.options.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    onChange({ ...group, options });
  }

  function removeOption(idx: number): void {
    const options = group.options.filter((_, i) => i !== idx);
    onChange({ ...group, options });
  }

  function addOption(): void {
    onChange({ ...group, options: [...group.options, emptyOption()] });
  }

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-700">Gruppe:</span>
          <input
            type="text"
            value={group.name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="z. B. Größe"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            aria-label="Gruppenname"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-700">Auswahl:</span>
          <select
            value={group.selection_type}
            onChange={(e) => setSelectionType(e.target.value as SelectionType)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            aria-label="Auswahltyp"
          >
            <option value="single">eine (single)</option>
            <option value="multi">mehrere (multi)</option>
          </select>
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
          aria-label="Gruppe entfernen"
        >
          Gruppe entfernen
        </button>
      </div>

      <ul className="space-y-1">
        {group.options.map((opt, idx) => (
          <li key={idx} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500" aria-hidden="true">
              {group.selection_type === 'single' ? '○' : '☐'}
            </span>
            <input
              type="text"
              value={opt.name}
              onChange={(e) => updateOption(idx, { name: e.target.value })}
              maxLength={200}
              placeholder="Name"
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1"
              aria-label={`Option ${idx + 1} Name`}
            />
            <OptionDeltaInput
              value={opt.price_delta_cents}
              onCommit={(next) => updateOption(idx, { price_delta_cents: next })}
              ariaLabel={`Option ${idx + 1} Preisaufschlag`}
            />
            <span className="hidden w-20 shrink-0 text-right text-xs text-gray-500 sm:inline-block">
              {opt.price_delta_cents === 0 ? '±0' : fmtPrice(opt.price_delta_cents)}
            </span>
            <button
              type="button"
              onClick={() => removeOption(idx)}
              className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              aria-label={`Option ${idx + 1} entfernen`}
            >
              Entfernen
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addOption}
        className="mt-2 rounded border border-dashed border-gray-400 px-3 py-1 text-xs text-gray-700 hover:bg-white"
      >
        + Option hinzufügen
      </button>
    </div>
  );
}
