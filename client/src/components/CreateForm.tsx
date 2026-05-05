import { useState } from 'react';
import type { FormEvent } from 'react';
import { cleanIban, formatIban, isValidIban } from '../lib/iban';
import type { CreateSessionInput, Session } from '../types/api';
import { createSession } from '../api/sessions';
import { ApiError } from '../api/client';
import type { Profile } from '../hooks/useProfile';
import { useRestaurants } from '../hooks/useRestaurants';
import { RestaurantCombobox } from './RestaurantCombobox';
import type { RestaurantSelection } from './RestaurantCombobox';
import { useToast } from './Toast';

export interface CreateFormProps {
  profile: Profile;
  onCreated: (session: Session) => void;
  onCancel?: () => void;
}

export function CreateForm({ profile, onCreated, onCancel }: CreateFormProps) {
  const [title, setTitle] = useState<string>('');
  const [restaurant, setRestaurant] = useState<RestaurantSelection>({
    restaurant_id: null,
    restaurant_name: '',
  });
  const [deadline, setDeadline] = useState<string>('');
  const { restaurants } = useRestaurants();
  const [iban, setIban] = useState<string>(profile.iban ? formatIban(profile.iban) : '');
  const [errors, setErrors] = useState<{ title?: string; iban?: string }>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const { showError } = useToast();

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedRestaurantName = restaurant.restaurant_name.trim();
    const trimmedDeadline = deadline.trim();
    const cleanedIban = cleanIban(iban);

    const next: { title?: string; iban?: string } = {};
    if (trimmedTitle.length === 0) {
      next.title = 'Bitte einen Titel eingeben.';
    } else if (trimmedTitle.length > 200) {
      next.title = 'Titel ist zu lang (max. 200 Zeichen).';
    }
    if (cleanedIban.length > 0 && !isValidIban(cleanedIban)) {
      next.iban = 'Diese IBAN ist ungültig.';
    }
    if (next.title || next.iban) {
      setErrors(next);
      return;
    }
    setErrors({});

    const input: CreateSessionInput = {
      user_id: profile.user_id,
      user_name: profile.user_name,
      title: trimmedTitle,
      restaurant_name: trimmedRestaurantName,
      deadline: trimmedDeadline,
      creator_iban: cleanedIban,
    };
    if (restaurant.restaurant_id !== null) {
      input.restaurant_id = restaurant.restaurant_id;
    }

    setSubmitting(true);
    try {
      const session = await createSession(input);
      onCreated(session);
    } catch (err) {
      if (err instanceof ApiError) {
        showError(err.message);
      } else {
        showError('Sammelbestellung konnte nicht angelegt werden.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-pad space-y-4 animate-fade-in-up"
      noValidate
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="h-section">Neue Sammelbestellung starten</h2>
          <p className="mt-1 help-xs">Titel und Restaurant — alles weitere ist optional.</p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-ghost btn-sm -mr-1.5"
            aria-label="Abbrechen"
          >
            ✕
          </button>
        ) : null}
      </div>

      <div>
        <label htmlFor="title" className="label">
          Titel
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="z. B. Pizza Freitag"
          className="input"
          aria-invalid={errors.title ? 'true' : 'false'}
        />
        {errors.title && (
          <p className="field-error" role="alert">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="restaurant" className="label">
          Restaurant <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <RestaurantCombobox
          id="restaurant"
          restaurants={restaurants}
          value={restaurant}
          onChange={setRestaurant}
        />
      </div>

      <div>
        <label htmlFor="deadline" className="label">
          Bestellschluss <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="deadline"
          type="text"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          maxLength={50}
          placeholder="z. B. heute 11:30"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="creator_iban" className="label">
          IBAN für Geld-Aufstellung{' '}
          <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="creator_iban"
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary flex-1"
        >
          {submitting ? 'Wird angelegt…' : 'Sammelbestellung starten'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-secondary"
          >
            Abbrechen
          </button>
        ) : null}
      </div>
    </form>
  );
}
