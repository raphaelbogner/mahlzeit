import type { SessionSummary } from '../types/api';
import { fmtPrice } from '../lib/price';
import { WorkspaceLink } from './WorkspaceLink';

export interface SessionListProps {
  sessions: SessionSummary[];
  loading: boolean;
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

export function SessionList({ sessions, loading }: SessionListProps) {
  if (loading && sessions.length === 0) {
    return (
      <ul className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-20 animate-pulse rounded border border-gray-200 bg-gray-50" />
        ))}
      </ul>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">
        Noch keine Sammelbestellung. Leg unten eine an.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {sessions.map((s) => (
        <li
          key={s.id}
          className="rounded border border-gray-200 bg-white transition hover:border-blue-400"
        >
          <WorkspaceLink to={`/s/${s.id}`} className="block p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-medium">{s.title}</h2>
                  {s.status === 'closed' && (
                    <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
                      geschlossen
                    </span>
                  )}
                </div>
                {s.restaurant_name && (
                  <p className="truncate text-sm text-gray-600">{s.restaurant_name}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  von {s.creator_name} · {formatDate(s.created_at)}
                  {s.deadline ? ` · bis ${s.deadline}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium">
                  {s.items_count ?? 0}{' '}
                  {(s.items_count ?? 0) === 1 ? 'Eintrag' : 'Einträge'}
                </p>
                {s.total_cents !== null && s.total_cents > 0 && (
                  <p className="text-xs text-gray-600">{fmtPrice(s.total_cents)}</p>
                )}
              </div>
            </div>
          </WorkspaceLink>
        </li>
      ))}
    </ul>
  );
}
