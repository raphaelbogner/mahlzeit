import { useEffect, useRef, useState } from 'react';
import { generateId } from '../lib/ids';
import { fmtPrice, parsePrice } from '../lib/price';
import type {
  CreateOptionTemplateInput,
  MenuDishInput,
  MenuOptionGroupInput,
  OptionTemplate,
} from '../types/api';
import { OptionGroupEditor } from './OptionGroupEditor';
import { DragHandle, SortableItem, SortableList } from './Sortable';

// Local invariant: every group carries an id (server-assigned for loaded
// groups, client-generated for newly added ones) so it's stable for keys
// and drag-and-drop.
type GroupInput = MenuOptionGroupInput & { id: string };

export interface DishEditorProps {
  dish: MenuDishInput;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onChange: (next: MenuDishInput) => void;
  onRemove: () => void;
  templates: OptionTemplate[];
  onSaveAsTemplate?: (input: CreateOptionTemplateInput) => Promise<void>;
  onDeleteTemplate?: (id: string) => Promise<void>;
  // Provided by the parent SortableList wrapper. Spread on the drag handle.
  dragHandleProps?: Record<string, unknown>;
}

function emptyGroup(): GroupInput {
  return {
    id: generateId(),
    name: '',
    selection_type: 'single',
    options: [{ id: generateId(), name: '', price_delta_cents: 0 }],
  };
}

function templateToGroup(tpl: OptionTemplate): GroupInput {
  return {
    id: generateId(),
    name: tpl.name,
    selection_type: tpl.selection_type,
    options: tpl.options.map((o) => ({
      id: generateId(),
      name: o.name,
      price_delta_cents: o.price_delta_cents,
    })),
  };
}

// Treat all groups in editor state as having ids (set on load via dishToInput,
// or via emptyGroup / templateToGroup for new ones).
function asGroups(groups: MenuOptionGroupInput[]): GroupInput[] {
  return groups.map((g) => (g.id ? (g as GroupInput) : { ...g, id: generateId() }));
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

export function DishEditor({
  dish,
  collapsed,
  onToggleCollapsed,
  onChange,
  onRemove,
  templates,
  onSaveAsTemplate,
  onDeleteTemplate,
  dragHandleProps,
}: DishEditorProps) {
  const [tplPickerOpen, setTplPickerOpen] = useState<boolean>(false);
  const tplPickerRef = useRef<HTMLDivElement | null>(null);

  // Close the template picker when clicking outside.
  useEffect(() => {
    if (!tplPickerOpen) return;
    function onDoc(e: MouseEvent): void {
      if (tplPickerRef.current && !tplPickerRef.current.contains(e.target as Node)) {
        setTplPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [tplPickerOpen]);

  function setName(name: string): void {
    onChange({ ...dish, name });
  }

  function setBasePrice(base_price_cents: number): void {
    onChange({ ...dish, base_price_cents });
  }

  const groups = asGroups(dish.option_groups);

  function updateGroup(id: string, next: MenuOptionGroupInput): void {
    const option_groups = groups.map((g) => (g.id === id ? { ...next, id } : g));
    onChange({ ...dish, option_groups });
  }

  function removeGroup(id: string): void {
    onChange({
      ...dish,
      option_groups: groups.filter((g) => g.id !== id),
    });
  }

  function reorderGroups(nextGroups: GroupInput[]): void {
    onChange({ ...dish, option_groups: nextGroups });
  }

  function addGroup(): void {
    onChange({
      ...dish,
      option_groups: [...groups, emptyGroup()],
    });
  }

  function insertTemplate(tpl: OptionTemplate): void {
    onChange({
      ...dish,
      option_groups: [...groups, templateToGroup(tpl)],
    });
    setTplPickerOpen(false);
  }

  if (collapsed) {
    const displayName = dish.name.trim() === '' ? 'Unbenanntes Gericht' : dish.name;
    const groupsLabel =
      groups.length === 0
        ? 'keine Optionen'
        : `${groups.length} ${groups.length === 1 ? 'Gruppe' : 'Gruppen'}`;
    return (
      <div className="card flex items-center gap-2 p-3 transition hover:ring-stone-300">
        {dragHandleProps ? <DragHandle handleProps={dragHandleProps} label="Gericht verschieben" /> : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
          aria-label="Gericht ausklappen"
          title="Ausklappen"
        >
          ▸
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
        >
          <span
            className={
              'truncate font-semibold ' +
              (dish.name.trim() === '' ? 'text-stone-400' : 'text-stone-900')
            }
          >
            {displayName}
          </span>
          <span className="shrink-0 text-xs text-stone-500 tabular-nums">
            {fmtPrice(dish.base_price_cents)} · {groupsLabel}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="btn-danger-soft btn-sm shrink-0"
          aria-label={`${displayName} entfernen`}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="card-pad">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {dragHandleProps ? <DragHandle handleProps={dragHandleProps} label="Gericht verschieben" /> : null}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-700"
          aria-label="Gericht einklappen"
          title="Einklappen"
        >
          ▾
        </button>
        <input
          type="text"
          value={dish.name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder="Name des Gerichts"
          className="input flex-1 text-base font-semibold"
          aria-label="Gerichtsname"
        />
        <button type="button" onClick={onRemove} className="btn-danger-soft btn-sm">
          Gericht entfernen
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <label className="text-stone-700" htmlFor={`base-${dish.id ?? dish.name}`}>
          Basispreis €:
        </label>
        <DishPriceInput value={dish.base_price_cents} onCommit={setBasePrice} />
        <span className="text-xs text-stone-500 tabular-nums">
          {fmtPrice(dish.base_price_cents)}
        </span>
      </div>

      {groups.length > 0 ? (
        <SortableList items={groups} onReorder={reorderGroups}>
          <div className="space-y-2">
            {groups.map((group) => (
              <SortableItem key={group.id} id={group.id}>
                {({ dragHandleProps: gHandle }) => (
                  <OptionGroupEditor
                    group={group}
                    onChange={(next) => updateGroup(group.id, next)}
                    onRemove={() => removeGroup(group.id)}
                    onSaveAsTemplate={onSaveAsTemplate}
                    dragHandleProps={gHandle}
                  />
                )}
              </SortableItem>
            ))}
          </div>
        </SortableList>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={addGroup} className="btn-dashed btn-sm">
          + Optionsgruppe hinzufügen
        </button>
        <div className="relative" ref={tplPickerRef}>
          <button
            type="button"
            onClick={() => setTplPickerOpen((v) => !v)}
            disabled={templates.length === 0}
            className="btn-secondary btn-sm"
            title={
              templates.length === 0
                ? 'Noch keine Templates. Speichere zuerst eine Optionsgruppe als Template.'
                : 'Optionsgruppe aus Template einfügen'
            }
          >
            ☆ Aus Template
            {templates.length > 0 ? (
              <span className="ml-1 text-stone-500">({templates.length})</span>
            ) : null}
          </button>
          {tplPickerOpen && templates.length > 0 ? (
            <div className="absolute left-0 z-20 mt-1.5 w-80 rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-stone-200 animate-fade-in-up">
              <ul className="max-h-72 overflow-auto">
                {templates.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-stone-50"
                  >
                    <button
                      type="button"
                      onClick={() => insertTemplate(tpl)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition hover:bg-orange-50"
                    >
                      <span className="truncate font-medium text-stone-900">{tpl.name}</span>
                      <span className="shrink-0 text-xs text-stone-500">
                        {tpl.selection_type === 'single' ? 'eine' : 'mehrere'} ·{' '}
                        {tpl.options.length} Opt.
                      </span>
                    </button>
                    {onDeleteTemplate ? (
                      <button
                        type="button"
                        onClick={() => void onDeleteTemplate(tpl.id)}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Template "${tpl.name}" löschen`}
                        title="Template löschen"
                      >
                        ✕
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
