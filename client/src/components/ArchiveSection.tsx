import { useState } from 'react';
import type { SessionSummary } from '../types/api';
import { filterArchive } from '../lib/archive';
import { SessionList } from './SessionList';

export interface ArchiveSectionProps {
  sessions: SessionSummary[];
  myUserId: string;
}

const STORAGE_KEY = 'mahlzeit.archive.open.v1';

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

// Collapsed by default so the main list stays short; remembers its state
// per browser. Search covers title and restaurant.
export function ArchiveSection({ sessions, myUserId }: ArchiveSectionProps) {
  const [open, setOpen] = useState<boolean>(readOpen);
  const [query, setQuery] = useState<string>('');

  if (sessions.length === 0) return null;

  function toggle(): void {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // per-browser convenience only
    }
  }

  const filtered = filterArchive(sessions, query);

  return (
    <section className="border-t border-stone-200 pt-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        <span>
          Archiv <span className="text-stone-500">({sessions.length})</span>
        </span>
        <span aria-hidden="true" className="text-stone-400">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Archiv durchsuchen (Titel, Restaurant)"
            className="input"
            aria-label="Archiv durchsuchen"
          />
          {filtered.length === 0 ? (
            <p className="help-xs px-1">Keine Treffer im Archiv.</p>
          ) : (
            <SessionList sessions={filtered} loading={false} myUserId={myUserId} />
          )}
        </div>
      ) : null}
    </section>
  );
}
