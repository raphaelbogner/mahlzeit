import { useState } from 'react';
import { generateId } from '../lib/ids';
import { fmtPrice, parsePrice } from '../lib/price';
import type {
  CreateOptionTemplateInput,
  MenuOptionGroupInput,
  MenuOptionInput,
  SelectionType,
} from '../types/api';
import { DragHandle, SortableItem, SortableList } from './Sortable';

// Local invariant: every option carries an id (server-assigned for loaded
// options, client-generated for newly added ones) so it's stable for keys
// and drag-and-drop.
type OptionWithId = MenuOptionInput & { id: string };

export interface OptionGroupEditorProps {
  group: MenuOptionGroupInput;
  onChange: (next: MenuOptionGroupInput) => void;
  onRemove: () => void;
  onSaveAsTemplate?: (input: CreateOptionTemplateInput) => Promise<void>;
  // Provided by the parent SortableList wrapper. Spread on the drag handle.
  dragHandleProps?: Record<string, unknown>;
}

function emptyOption(): OptionWithId {
  return { id: generateId(), name: '', price_delta_cents: 0 };
}

function asOptions(options: MenuOptionInput[]): OptionWithId[] {
  return options.map((o) => (o.id ? (o as OptionWithId) : { ...o, id: generateId() }));
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
        'block w-24 rounded-lg bg-white px-2.5 py-1.5 text-right text-sm text-stone-900 shadow-sm ring-1 transition focus:outline-none focus:ring-2 focus:ring-orange-500 ' +
        (valid ? 'ring-stone-300' : 'ring-rose-400')
      }
      aria-label={ariaLabel}
      aria-invalid={!valid}
    />
  );
}

export function OptionGroupEditor({
  group,
  onChange,
  onRemove,
  onSaveAsTemplate,
  dragHandleProps,
}: OptionGroupEditorProps) {
  const [savingTpl, setSavingTpl] = useState<boolean>(false);

  function setName(name: string): void {
    onChange({ ...group, name });
  }

  function setSelectionType(selection_type: SelectionType): void {
    onChange({ ...group, selection_type });
  }

  const options = asOptions(group.options);

  function updateOption(id: string, patch: Partial<MenuOptionInput>): void {
    const next = options.map((o) => (o.id === id ? { ...o, ...patch } : o));
    onChange({ ...group, options: next });
  }

  function removeOption(id: string): void {
    onChange({ ...group, options: options.filter((o) => o.id !== id) });
  }

  function addOption(): void {
    onChange({ ...group, options: [...options, emptyOption()] });
  }

  function reorderOptions(nextOptions: OptionWithId[]): void {
    onChange({ ...group, options: nextOptions });
  }

  // Ready to save as template = name set and at least one option with a name.
  const canSaveAsTemplate =
    onSaveAsTemplate !== undefined &&
    group.name.trim() !== '' &&
    options.some((o) => o.name.trim() !== '');

  async function handleSaveAsTemplate(): Promise<void> {
    if (!onSaveAsTemplate) return;
    setSavingTpl(true);
    try {
      await onSaveAsTemplate({
        name: group.name.trim(),
        selection_type: group.selection_type,
        options: options
          .filter((o) => o.name.trim() !== '')
          .map((o) => ({
            name: o.name.trim(),
            price_delta_cents: o.price_delta_cents,
          })),
      });
    } finally {
      setSavingTpl(false);
    }
  }

  return (
    <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-200">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {dragHandleProps ? (
          <DragHandle handleProps={dragHandleProps} label="Optionsgruppe verschieben" />
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-stone-700">Gruppe:</span>
          <input
            type="text"
            value={group.name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="z. B. Größe"
            className="block rounded-lg bg-white px-2.5 py-1 text-sm text-stone-900 shadow-sm ring-1 ring-stone-300 transition focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Gruppenname"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-stone-700">Auswahl:</span>
          <select
            value={group.selection_type}
            onChange={(e) => setSelectionType(e.target.value as SelectionType)}
            className="block rounded-lg bg-white px-2.5 py-1 text-sm text-stone-900 shadow-sm ring-1 ring-stone-300 transition focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Auswahltyp"
          >
            <option value="single">eine (single)</option>
            <option value="multi">mehrere (multi)</option>
          </select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          {onSaveAsTemplate ? (
            <button
              type="button"
              onClick={() => void handleSaveAsTemplate()}
              disabled={!canSaveAsTemplate || savingTpl}
              className="btn-secondary btn-sm"
              title={
                canSaveAsTemplate
                  ? 'Gruppe als Template speichern'
                  : 'Name und mindestens eine Option mit Namen nötig'
              }
            >
              {savingTpl ? '…' : '☆ Als Template'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            className="btn-danger-soft btn-sm"
            aria-label="Gruppe entfernen"
          >
            Gruppe entfernen
          </button>
        </div>
      </div>

      {options.length > 0 ? (
        <SortableList items={options} onReorder={reorderOptions}>
          <ul className="space-y-1.5">
            {options.map((opt, idx) => (
              <SortableItem key={opt.id} id={opt.id}>
                {({ dragHandleProps: oHandle }) => (
                  <li className="flex flex-wrap items-center gap-2 text-sm">
                    <DragHandle handleProps={oHandle} label="Option verschieben" />
                    <span className="text-stone-400" aria-hidden="true">
                      {group.selection_type === 'single' ? '○' : '☐'}
                    </span>
                    <input
                      type="text"
                      value={opt.name}
                      onChange={(e) => updateOption(opt.id, { name: e.target.value })}
                      maxLength={200}
                      placeholder="Name"
                      className="min-w-0 flex-1 rounded-lg bg-white px-2.5 py-1.5 text-sm text-stone-900 shadow-sm ring-1 ring-stone-300 transition focus:outline-none focus:ring-2 focus:ring-orange-500"
                      aria-label={`Option ${idx + 1} Name`}
                    />
                    <OptionDeltaInput
                      value={opt.price_delta_cents}
                      onCommit={(next) => updateOption(opt.id, { price_delta_cents: next })}
                      ariaLabel={`Option ${idx + 1} Preisaufschlag`}
                    />
                    <span className="hidden w-20 shrink-0 text-right text-xs text-stone-500 tabular-nums sm:inline-block">
                      {opt.price_delta_cents === 0 ? '±0' : fmtPrice(opt.price_delta_cents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      className="btn-danger-soft btn-sm"
                      aria-label={`Option ${idx + 1} entfernen`}
                    >
                      ✕
                    </button>
                  </li>
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableList>
      ) : null}

      <button type="button" onClick={addOption} className="btn-dashed btn-sm mt-3">
        + Option hinzufügen
      </button>
    </div>
  );
}
