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
}

export function CreateForm({ profile, onCreated }: CreateFormProps) {
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
      className="space-y-4 rounded border border-gray-200 bg-white p-4"
      noValidate
    >
      <h2 className="text-lg font-medium">Neue Sammelbestellung</h2>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium">
          Titel
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="z. B. Pizza Freitag"
          className="w-full rounded border border-gray-300 px-3 py-2"
          aria-invalid={errors.title ? 'true' : 'false'}
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="restaurant" className="mb-1 block text-sm font-medium">
          Restaurant <span className="text-gray-500">(optional)</span>
        </label>
        <RestaurantCombobox
          id="restaurant"
          restaurants={restaurants}
          value={restaurant}
          onChange={setRestaurant}
        />
      </div>

      <div>
        <label htmlFor="deadline" className="mb-1 block text-sm font-medium">
          Bestellschluss <span className="text-gray-500">(optional)</span>
        </label>
        <input
          id="deadline"
          type="text"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          maxLength={50}
          placeholder="z. B. heute 11:30"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="creator_iban" className="mb-1 block text-sm font-medium">
          IBAN für Geld-Aufstellung <span className="text-gray-500">(optional)</span>
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
        disabled={submitting}
        className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Wird angelegt…' : 'Sammelbestellung starten'}
      </button>
    </form>
  );
}
