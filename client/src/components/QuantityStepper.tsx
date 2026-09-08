import { useState } from 'react';
import { clampQuantity, parseQuantity, MAX_QUANTITY, MIN_QUANTITY } from '../lib/quantity';

export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  // Accessible name for the input, e.g. "Menge für Cola".
  label?: string;
}

// [−] [ 1 ] [+] control. The text field accepts typed numbers and snaps back
// to a valid value on blur so the parent always holds a clamped quantity.
export function QuantityStepper({ value, onChange, disabled, label }: QuantityStepperProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const shown = draft ?? String(value);
  const atMin = value <= MIN_QUANTITY;
  const atMax = value >= MAX_QUANTITY;

  function commit(text: string): void {
    const parsed = parseQuantity(text);
    if (parsed !== null && parsed !== value) onChange(parsed);
    setDraft(null);
  }

  const btn =
    'flex h-8 w-8 items-center justify-center rounded-md text-base font-medium text-stone-700 ' +
    'ring-1 ring-stone-300 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label ?? 'Menge'}>
      <button
        type="button"
        onClick={() => onChange(clampQuantity(value - 1))}
        disabled={disabled || atMin}
        className={btn}
        aria-label="Menge verringern"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={shown}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
        disabled={disabled}
        className="input h-8 w-12 px-1 text-center tabular-nums"
        aria-label={label ?? 'Menge'}
      />
      <button
        type="button"
        onClick={() => onChange(clampQuantity(value + 1))}
        disabled={disabled || atMax}
        className={btn}
        aria-label="Menge erhöhen"
      >
        +
      </button>
    </div>
  );
}
