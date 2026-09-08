import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useNow } from '../hooks/useNow';
import { useErrorToast, useToast } from './Toast';
import { AddItemForm } from './AddItemForm';
import { ItemRow } from './ItemRow';
import { ProfileMenu } from './ProfileMenu';
import { DuePill } from './DuePill';
import { Summary } from './Summary';
import { DeadlineBadge } from './DeadlineBadge';
import { DeadlinePicker } from './DeadlinePicker';
import { ShareButton } from './ShareButton';
import { WorkspaceLink, useWorkspaceNavigate } from './WorkspaceLink';
import { ApiError, getWorkspaceToken } from '../api/client';
import { buildInviteText, buildSessionUrl } from '../lib/share';
import { deleteSession, updateSession } from '../api/sessions';
import type { Profile } from '../hooks/useProfile';
import type { Item, Session } from '../types/api';
import { fmtPrice } from '../lib/price';
import { formatIban } from '../lib/iban';
import { parseDeadline } from '../lib/deadline';
import { hasOpenDues } from '../lib/archive';
import { declineSession, undeclineSession } from '../api/participation';
import { ParticipationPanel } from './ParticipationPanel';

export interface SessionDetailProps {
  profile: Profile;
}

function totalCents(session: Session): number {
  let total = 0;
  for (const item of session.items) {
    if (item.price_cents !== null) total += item.price_cents * item.quantity;
  }
  return total;
}

export function SessionDetail({ profile }: SessionDetailProps) {
  const params = useParams<{ id: string }>();
  const navigate = useWorkspaceNavigate();
  const { session, loading, error, setSession, refresh } = useSession(params.id, profile.user_id);
  useErrorToast(error);
  const { showError } = useToast();

  const [busy, setBusy] = useState<boolean>(false);
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const [editingDeadline, setEditingDeadline] = useState<boolean>(false);
  const [deadlineDraft, setDeadlineDraft] = useState<Date | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState<boolean>(false);

  // Once the countdown hits zero the server closes the session on its next
  // request; poll immediately so the UI flips without waiting for the timer.
  const deadline = parseDeadline(session?.deadline_at ?? null);
  const now = useNow(deadline && session?.status === 'open' ? 15_000 : 0);
  const deadlinePassed =
    deadline !== null && session?.status === 'open' && deadline.getTime() <= now.getTime();
  useEffect(() => {
    if (deadlinePassed) refresh();
  }, [deadlinePassed, refresh]);

  if (loading && !session) {
    return (
      <div className="page">
        <div className="page-container">
          <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />
          <div className="mt-6 space-y-2.5" aria-busy="true">
            <div className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-stone-200/70" />
            <div className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-stone-200/70" />
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page">
        <div className="page-container">
          <p className="help">
            Sammelbestellung nicht gefunden.{' '}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-link"
            >
              Zurück zur Liste
            </button>
          </p>
        </div>
      </div>
    );
  }

  const isOpen = session.status === 'open';
  const isCreator = session.creator_id === profile.user_id;
  const effectivePayerId = session.paid_by_user_id ?? session.creator_id;
  const isArchived = session.archived_at !== null;
  const canArchive = isCreator || profile.user_id === effectivePayerId;
  const canSeeParticipation = isCreator || profile.user_id === effectivePayerId;
  const hasOwnItems = session.items.some((it) => it.user_id === profile.user_id);
  const sessionUrl = buildSessionUrl(session.id, getWorkspaceToken() ?? '', window.location.origin);

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

  async function handleDecline(declined: boolean): Promise<void> {
    if (!session) return;
    setBusy(true);
    try {
      if (declined) {
        await declineSession(session.id, {
          user_id: profile.user_id,
          user_name: profile.user_name,
        });
      } else {
        await undeclineSession(session.id, { user_id: profile.user_id });
      }
      setSession({ ...session, my_declined: declined });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(archived: boolean): Promise<void> {
    if (!session) return;
    setBusy(true);
    try {
      const next = await updateSession(session.id, { user_id: profile.user_id, archived });
      setSession({ ...next, items: session.items });
      setConfirmingArchive(false);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Aktion fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  function requestArchive(): void {
    if (!session) return;
    // Ask first when money is still outstanding; archiving hides it from the
    // due overview.
    if (hasOpenDues(session.items)) {
      setConfirmingArchive(true);
      return;
    }
    void handleArchive(true);
  }

  function startEditDeadline(): void {
    if (!session) return;
    setDeadlineDraft(parseDeadline(session.deadline_at));
    setEditingDeadline(true);
  }

  async function handleSaveDeadline(): Promise<void> {
    if (!session) return;
    if (deadlineDraft !== null && deadlineDraft.getTime() <= Date.now()) {
      showError('Der Bestellschluss muss in der Zukunft liegen.');
      return;
    }
    setBusy(true);
    try {
      const next = await updateSession(session.id, {
        user_id: profile.user_id,
        deadline_at: deadlineDraft ? deadlineDraft.toISOString() : null,
      });
      setSession({ ...next, items: session.items });
      setEditingDeadline(false);
    } catch (err) {
      showError(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
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
    <div className="page">
      <header className="app-header">
        <div className="app-header-inner">
          <WorkspaceLink to="/" className="btn-link">
            ← Sammelbestellungen
          </WorkspaceLink>
          <div className="flex items-center gap-3">
            <DuePill />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <main className="page-container">
        <div className="layout-2col">
        <div className="layout-main">
        <header className="card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="h-page truncate">{session.title}</h1>
                {isOpen ? (
                  <span className="badge-success">offen</span>
                ) : isArchived ? (
                  <span className="badge-neutral">archiviert</span>
                ) : (
                  <span className="badge-neutral">geschlossen</span>
                )}
              </div>
              {session.restaurant_name && (
                <p className="mt-1 text-sm text-stone-600">{session.restaurant_name}</p>
              )}
              <p className="mt-1 help-xs">von {session.creator_name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <DeadlineBadge
                  deadlineAt={session.deadline_at}
                  deadlineText={session.deadline}
                  status={session.status}
                  autoClosed={session.auto_closed}
                />
                {isCreator && isOpen && !editingDeadline ? (
                  <button
                    type="button"
                    onClick={startEditDeadline}
                    disabled={busy}
                    className="btn-link text-xs"
                  >
                    {session.deadline_at ? 'Ändern' : 'Bestellschluss setzen'}
                  </button>
                ) : null}
              </div>
              {isOpen && canSeeParticipation ? (
                <ParticipationPanel session={session} profile={profile} sessionUrl={sessionUrl} />
              ) : null}
              {isOpen && session.my_declined ? (
                <p className="mt-2 text-xs text-stone-500">
                  Du hast für heute abgesagt. Sobald du etwas bestellst, gilt das nicht mehr.
                </p>
              ) : null}
              {editingDeadline ? (
                <div className="mt-3 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
                  <DeadlinePicker
                    value={deadlineDraft}
                    onChange={setDeadlineDraft}
                    disabled={busy}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveDeadline()}
                      disabled={busy}
                      className="btn-primary btn-sm"
                    >
                      {busy ? 'Speichert…' : 'Speichern'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingDeadline(false)}
                      disabled={busy}
                      className="btn-secondary btn-sm"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : null}
              {session.creator_iban && (
                <p className="mt-1 font-mono text-xs text-stone-500">
                  IBAN: {formatIban(session.creator_iban)}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isOpen ? (
                <ShareButton
                  label="Einladen"
                  title={`Sammelbestellung: ${session.title}`}
                  getText={() =>
                    buildInviteText({
                      title: session.title,
                      restaurant_name: session.restaurant_name,
                      deadline_at: session.deadline_at,
                      url: sessionUrl,
                    })
                  }
                />
              ) : null}
            {isOpen && !hasOwnItems ? (
              session.my_declined ? (
                <button
                  type="button"
                  onClick={() => void handleDecline(false)}
                  disabled={busy}
                  className="btn-secondary btn-sm"
                  title="Absage zurücknehmen"
                >
                  Doch dabei
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleDecline(true)}
                  disabled={busy}
                  className="btn-ghost btn-sm"
                  title="Du wirst nicht als fehlend gelistet"
                >
                  Heute nicht dabei
                </button>
              )
            ) : null}
            {!isOpen && canArchive ? (
              isArchived ? (
                <button
                  type="button"
                  onClick={() => void handleArchive(false)}
                  disabled={busy}
                  className="btn-secondary btn-sm"
                >
                  Wiederherstellen
                </button>
              ) : confirmingArchive ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-700">Noch Beträge offen – trotzdem?</span>
                  <button
                    type="button"
                    onClick={() => void handleArchive(true)}
                    disabled={busy}
                    className="btn-warn-soft btn-sm"
                  >
                    Archivieren
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingArchive(false)}
                    disabled={busy}
                    className="btn-secondary btn-sm"
                  >
                    Nein
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={requestArchive}
                  disabled={busy}
                  className="btn-secondary btn-sm"
                >
                  Archivieren
                </button>
              )
            ) : null}
            {isCreator && (
              <>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  disabled={busy}
                  className="btn-secondary btn-sm"
                >
                  {isOpen ? 'Schließen' : 'Wieder öffnen'}
                </button>
                {!confirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={busy}
                    className="btn-danger-soft btn-sm"
                  >
                    Löschen
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-700">Wirklich?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={busy}
                      className="btn-danger btn-sm"
                    >
                      Ja, löschen
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={busy}
                      className="btn-secondary btn-sm"
                    >
                      Nein
                    </button>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        </header>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="h-section">Einträge ({session.items.length})</h2>
            <span className="text-sm text-stone-700 tabular-nums">
              Summe: <span className="font-semibold text-stone-900">{fmtPrice(totalCents(session))}</span>
            </span>
          </div>
          {session.items.length === 0 ? (
            <p className="empty">Noch keine Einträge. Sei die erste Person.</p>
          ) : (
            <ul className="space-y-2">
              {session.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  sessionId={session.id}
                  profile={profile}
                  sessionOpen={isOpen}
                  effectivePayerId={effectivePayerId}
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
            disabled={deadlinePassed}
          />
        ) : (
          <p className="card-pad text-center text-sm text-stone-600">
            Diese Sammelbestellung ist geschlossen.
          </p>
        )}

        </div>

        {/* Desktop: sticky right column; mobile: below the entries. */}
        <aside className="layout-side">
          <Summary
            session={session}
            profile={profile}
            onSessionChanged={(next) => setSession(next)}
          />
        </aside>
        </div>
      </main>
    </div>
  );
}
