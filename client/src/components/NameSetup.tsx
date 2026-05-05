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
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2">
          <span className="brand-dot" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-tight text-stone-900">Mahlzeit</span>
        </div>
        <div className="card-pad animate-fade-in-up">
          <h1 className="h-page">Willkommen</h1>
          <p className="mt-2 help">
            Wie sollen wir dich nennen? Die IBAN ist optional und wird nur für Geld-Aufstellungen
            am Ende einer Sammelbestellung verwendet.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="name" className="label">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoComplete="name"
                className="input"
                aria-invalid={errors.name ? 'true' : 'false'}
              />
              {errors.name && (
                <p className="field-error" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="iban" className="label">
                IBAN <span className="font-normal text-stone-400">(optional)</span>
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
                className="input-mono"
                aria-invalid={errors.iban ? 'true' : 'false'}
              />
              {errors.iban && (
                <p className="field-error" role="alert">
                  {errors.iban}
                </p>
              )}
            </div>

            <button type="submit" className="btn-primary mt-6 w-full">
              Weiter
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
