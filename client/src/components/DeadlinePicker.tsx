import { useState } from 'react';
import {
  addMinutes,
  atLocalTime,
  formatDeadline,
  nextOccurrence,
  toTimeInputValue,
} from '../lib/deadline';

export interface DeadlinePickerProps {
  value: Date | null;
  onChange: (next: Date | null) => void;
  disabled?: boolean;
}

type Day = 'today' | 'tomorrow';

const RELATIVE_CHIPS: { label: string; minutes: number }[] = [
  { label: '+30 min', minutes: 30 },
  { label: '+1 h', minutes: 60 },
];
const FIXED_CHIPS = ['11:30', '12:00'];

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayOf(value: Date, now: Date): Day {
  const today = startOfDay(now).getTime();
  return startOfDay(value).getTime() === today ? 'today' : 'tomorrow';
}

// Quick chips plus a "today/tomorrow + HH:MM" field. Emits a local Date (or
// null for "no deadline"); the caller converts to ISO for the API.
export function DeadlinePicker({ value, onChange, disabled }: DeadlinePickerProps) {
  const now = new Date();
  const [day, setDay] = useState<Day>(value ? dayOf(value, now) : 'today');
  const [time, setTime] = useState<string>(value ? toTimeInputValue(value) : '');

  function apply(next: Date | null): void {
    if (next) {
      setDay(dayOf(next, now));
      setTime(toTimeInputValue(next));
    } else {
      setTime('');
    }
    onChange(next);
  }

  function dayDate(which: Day): Date {
    const d = new Date(now);
    if (which === 'tomorrow') d.setDate(d.getDate() + 1);
    return d;
  }

  function handleTimeChange(next: string): void {
    setTime(next);
    if (next === '') {
      onChange(null);
      return;
    }
    const d = atLocalTime(dayDate(day), next);
    if (d) onChange(d);
  }

  function handleDayChange(next: Day): void {
    setDay(next);
    if (time !== '') {
      const d = atLocalTime(dayDate(next), time);
      if (d) onChange(d);
    }
  }

  const chip = (active: boolean) =>
    'rounded-full px-3 py-1 text-xs font-medium ring-1 transition disabled:opacity-50 ' +
    (active
      ? 'bg-orange-500 text-white ring-orange-500'
      : 'bg-white text-stone-700 ring-stone-300 hover:ring-orange-300');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Schnellwahl Bestellschluss">
        {RELATIVE_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={disabled}
            onClick={() => apply(addMinutes(new Date(), c.minutes))}
            className={chip(false)}
          >
            {c.label}
          </button>
        ))}
        {FIXED_CHIPS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => apply(nextOccurrence(t, new Date()))}
            className={chip(false)}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || value === null}
          onClick={() => apply(null)}
          className={chip(false)}
        >
          Kein Bestellschluss
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg ring-1 ring-stone-300" role="group" aria-label="Tag">
          {(['today', 'tomorrow'] as Day[]).map((d) => (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => handleDayChange(d)}
              aria-pressed={day === d}
              className={
                'px-3 py-1.5 text-sm transition first:rounded-l-lg last:rounded-r-lg ' +
                (day === d ? 'bg-stone-800 text-white' : 'bg-white text-stone-700 hover:bg-stone-50')
              }
            >
              {d === 'today' ? 'Heute' : 'Morgen'}
            </button>
          ))}
        </div>
        <input
          type="time"
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          disabled={disabled}
          className="input w-32"
          aria-label="Uhrzeit Bestellschluss"
          step={60}
        />
        {value ? (
          <span className="text-sm text-stone-600 tabular-nums">
            → {formatDeadline(value, new Date())}
          </span>
        ) : (
          <span className="help-xs">optional</span>
        )}
      </div>
    </div>
  );
}
