import { useState } from 'react';
import type { FormEvent } from 'react';
import { cleanIban, formatIban, isValidIban } from '../lib/iban';

export interface NameSetupProps {
  initialName?: string;
  initialIban?: string;
  onSubmit: (input: { user_name: string; iban: string }) => void;
}

export function NameSetup({
  initialName = '',
  initialIban = '',
  onSubmit,
}: NameSetupProps) {
  const [name, setName] = useState<string>(initialName);
  const [iban, setIban] = useState<string>(initialIban ? formatIban(initialIban) : '');
  const [errors, setErrors] = useState<{ name?: string; iban?: string }>({});

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const trimmedName = name.trim();
    const cleanedIban = cleanIban(iban);
    const next: { name?: string; iban?: string } = {};
    if (trimmedName.length === 0) {
      next.name = 'Bitte einen Namen eingeben.';
    } else if (trimmedName.length > 120) {
      next.name = 'Name ist zu lang (max. 120 Zeichen).';
    }
    if (cleanedIban.length > 0 && !isValidIban(cleanedIban)) {
      next.iban = 'Diese IBAN ist ungültig.';
    }
    if (next.name || next.iban) {
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit({ user_name: trimmedName, iban: cleanedIban });
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Willkommen bei Mahlzeit</h1>
      <p className="mb-6 text-sm text-gray-600">
        Wie sollen wir dich nennen? Die IBAN ist optional und wird nur für
        Geld-Aufstellungen am Ende einer Sammelbestellung verwendet.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoComplete="name"
            className="w-full rounded border border-gray-300 px-3 py-2"
            aria-invalid={errors.name ? 'true' : 'false'}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="iban" className="mb-1 block text-sm font-medium">
            IBAN <span className="text-gray-500">(optional)</span>
          </label>
          <input
            id="iban"
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            onBlur={(e) => setIban(formatIban(e.target.value))}
            placeholder="AT61 1904 3002 3457 3201"
            maxLength={42}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded border border-gray-300 px-3 py-2 font-mono"
            aria-invalid={errors.iban ? 'true' : 'false'}
          />
          {errors.iban && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errors.iban}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Weiter
        </button>
      </form>
    </div>
  );
}
