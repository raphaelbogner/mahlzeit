import { useEffect, useRef, useState } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useDueSessions } from '../hooks/useDueSessions';
import { collectDue } from '../lib/due';
import { fmtPrice } from '../lib/price';
import type { SessionSummary } from '../types/api';
import { WorkspaceLink } from './WorkspaceLink';

export interface DuePillProps {
  // Reuse a list the page already polls; otherwise the pill fetches its own.
  sessions?: SessionSummary[];
}

// Header pill "8,40 € offen" with a dropdown of the sessions behind it. Only
// counts closed, non-archived sessions where the viewer is not the payer.
export function DuePill({ sessions }: DuePillProps) {
  const { profile } = useProfile();
  const fetched = useDueSessions(profile?.user_id ?? '', sessions === undefined && profile !== null);
  const [open, setOpen] = useState<boolean>(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!profile) return null;
  const overview = collectDue(sessions ?? fetched, profile.user_id);
  if (overview.total_cents <= 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800 ring-1 ring-orange-200 transition hover:bg-orange-200 tabular-nums"
        title="Offene Beträge"
      >
        {fmtPrice(overview.total_cents)} offen
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 rounded-xl bg-white p-2 shadow-pop ring-1 ring-stone-200"
        >
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-stone-500">
            Du schuldest noch
          </p>
          <ul className="max-h-72 overflow-y-auto">
            {overview.entries.map(({ session, due }) => (
              <li key={session.id}>
                <WorkspaceLink
                  to={`/s/${session.id}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-stone-900">{session.title}</span>
                    <span className="block truncate text-xs text-stone-500">
                      an {session.paid_by_user_id ? session.paid_by_user_name : session.creator_name}
                      {due.state === 'reported' ? ' · gemeldet' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-stone-900 tabular-nums">
                    {fmtPrice(due.due_cents)}
                  </span>
                </WorkspaceLink>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
