import type { SessionSummary } from '../types/api';
import { fmtPrice } from '../lib/price';
import { WorkspaceLink } from './WorkspaceLink';
import { DeadlineBadge } from './DeadlineBadge';
import { computeMyDue } from '../lib/due';

export interface SessionListProps {
  sessions: SessionSummary[];
  loading: boolean;
  // Viewer id; enables the per-card "Dein Anteil" hint on closed sessions.
  myUserId?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function SessionList({ sessions, loading, myUserId }: SessionListProps) {
  if (loading && sessions.length === 0) {
    return (
      <ul className="space-y-2.5" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-stone-200/70" />
        ))}
      </ul>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="empty">
        Noch keine Sammelbestellung. Leg eine an und teile die Lust auf Mittagessen.
      </div>
    );
  }

  return (
    <ul className="grid gap-2.5 lg:grid-cols-2 2xl:grid-cols-3">
      {sessions.map((s) => {
        const isOpen = s.status === 'open';
        const priced = s.priced_items_count ?? 0;
        const paid = s.paid_items_count ?? 0;
        // Payment progress is only meaningful once the order is closed.
        const showPaid = !isOpen && priced > 0;
        const allPaid = paid >= priced;
        const myDue = myUserId ? computeMyDue(s, myUserId) : null;
        return (
          <li
            key={s.id}
            className="group card h-full transition hover:-translate-y-0.5 hover:shadow-pop hover:ring-orange-300"
          >
            <WorkspaceLink to={`/s/${s.id}`} className="block h-full p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="line-clamp-2 break-words text-base font-semibold text-stone-900">
                      {s.title}
                    </h2>
                    {isOpen ? (
                      <span className="badge-success">offen</span>
                    ) : s.archived_at !== null ? (
                      <span className="badge-neutral">archiviert</span>
                    ) : (
                      <span className="badge-neutral">geschlossen</span>
                    )}
                    {showPaid &&
                      (allPaid ? (
                        <span className="badge-info">✓ bezahlt</span>
                      ) : (
                        <span className="badge-info">
                          {paid}/{priced} bezahlt
                        </span>
                      ))}
                  </div>
                  {s.restaurant_name && (
                    <p className="mt-0.5 truncate text-sm text-stone-600">{s.restaurant_name}</p>
                  )}
                  <p className="mt-1 help-xs">
                    von {s.creator_name} · {formatDate(s.created_at)}
                  </p>
                  <p className="mt-0.5 empty:hidden">
                    <DeadlineBadge
                      deadlineAt={s.deadline_at}
                      deadlineText={s.deadline}
                      status={s.status}
                      autoClosed={s.auto_closed}
                      compact
                    />
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-stone-900 tabular-nums">
                    {s.items_count ?? 0}{' '}
                    <span className="text-stone-500">
                      {(s.items_count ?? 0) === 1 ? 'Eintrag' : 'Einträge'}
                    </span>
                  </p>
                  {s.total_cents !== null && s.total_cents > 0 && (
                    <p className="text-xs text-stone-600 tabular-nums">{fmtPrice(s.total_cents)}</p>
                  )}
                  {myDue && myDue.state === 'open' ? (
                    <p className="mt-1 text-xs font-medium text-orange-700 tabular-nums">
                      Dein Anteil: {fmtPrice(myDue.due_cents)} offen
                    </p>
                  ) : myDue && myDue.state === 'reported' ? (
                    <p className="mt-1 text-xs text-amber-700">Überweisung gemeldet</p>
                  ) : myDue && myDue.state === 'paid' ? (
                    <p className="mt-1 text-xs text-emerald-700">✓ Dein Anteil bezahlt</p>
                  ) : null}
                </div>
              </div>
            </WorkspaceLink>
          </li>
        );
      })}
    </ul>
  );
}
