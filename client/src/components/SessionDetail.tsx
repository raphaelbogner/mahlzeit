import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useErrorToast, useToast } from './Toast';
import { AddItemForm } from './AddItemForm';
import { ItemRow } from './ItemRow';
import { Summary } from './Summary';
import { WorkspaceLink, useWorkspaceNavigate } from './WorkspaceLink';
import { ApiError } from '../api/client';
import { deleteSession, updateSession } from '../api/sessions';
import type { Profile } from '../hooks/useProfile';
import type { Item, Session } from '../types/api';
import { fmtPrice } from '../lib/price';
import { formatIban } from '../lib/iban';

export interface SessionDetailProps {
  profile: Profile;
}

function totalCents(session: Session): number {
  let total = 0;
  for (const item of session.items) {
    if (item.price_cents !== null) total += item.price_cents;
  }
  return total;
}

export function SessionDetail({ profile }: SessionDetailProps) {
  const params = useParams<{ id: string }>();
  const navigate = useWorkspaceNavigate();
  const { session, loading, error, setSession } = useSession(params.id);
  useErrorToast(error);
  const { showError } = useToast();

  const [busy, setBusy] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);

  if (loading && !session) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-16 animate-pulse rounded bg-gray-100" />
          <div className="h-16 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-sm text-gray-700">
          Sammelbestellung nicht gefunden.{' '}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-blue-600 underline"
          >
            Zurück zur Liste
          </button>
        </p>
      </div>
    );
  }

  const isOpen = session.status === 'open';
  const isCreator = session.creator_id === profile.user_id;

  function handleItemAdded(item: Item): void {
    if (!session) return;
    setSession({ ...session, items: [...session.items, item] });
  }

  function handleItemChanged(updated: Item): void {
    if (!session) return;
    setSession({
      ...session,
      items: session.items.map((it) => (it.id === updated.id ? updated : it)),
    });
  }

  function handleItemDeleted(itemId: string): void {
    if (!session) return;
    setSession({ ...session, items: session.items.filter((it) => it.id !== itemId) });
  }

  async function handleToggleStatus(): Promise<void> {
    if (!session) return;
    setBusy(true);
    try {
      const next = await updateSession(session.id, {
        user_id: profile.user_id,
        status: isOpen ? 'closed' : 'open',
      });
      setSession({ ...next, items: session.items });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!session) return;
    setBusy(true);
    try {
      await deleteSession(session.id, { user_id: profile.user_id });
      navigate('/');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.');
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="mb-4">
        <WorkspaceLink to="/" className="text-sm text-blue-600 hover:underline">
          ← Zurück zur Liste
        </WorkspaceLink>
      </div>

      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">{session.title}</h1>
          {!isOpen && (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
              geschlossen
            </span>
          )}
        </div>
        {session.restaurant_name && (
          <p className="mt-1 text-sm text-gray-700">{session.restaurant_name}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          von {session.creator_name}
          {session.deadline ? ` · bis ${session.deadline}` : ''}
        </p>
        {session.creator_iban && (
          <p className="mt-1 font-mono text-xs text-gray-500">
            IBAN: {formatIban(session.creator_iban)}
          </p>
        )}
      </header>

      {isCreator && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={busy}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {isOpen ? 'Schließen' : 'Wieder öffnen'}
          </button>
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Löschen
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Wirklich löschen?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Ja, löschen
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Nein
              </button>
            </div>
          )}
        </div>
      )}

      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-base font-medium">
            Einträge ({session.items.length})
          </h2>
          <span className="text-sm text-gray-700">
            Summe: {fmtPrice(totalCents(session))}
          </span>
        </div>
        {session.items.length === 0 ? (
          <p className="rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-600">
            Noch keine Einträge.
          </p>
        ) : (
          <ul className="space-y-2">
            {session.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                sessionId={session.id}
                profile={profile}
                sessionOpen={isOpen}
                onChanged={handleItemChanged}
                onDeleted={handleItemDeleted}
              />
            ))}
          </ul>
        )}
      </section>

      {isOpen ? (
        <AddItemForm
          sessionId={session.id}
          restaurantId={session.restaurant_id}
          profile={profile}
          onAdded={handleItemAdded}
        />
      ) : (
        <p className="rounded border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
          Diese Sammelbestellung ist geschlossen.
        </p>
      )}

      <Summary session={session} />
    </div>
  );
}
