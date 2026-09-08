import type { SessionSummary } from '../types/api';
import { fold } from './dishDisplay';

export function isArchived(session: Pick<SessionSummary, 'archived_at'>): boolean {
  return session.archived_at !== null;
}

export interface SplitSessions<T> {
  active: T[];
  archived: T[];
}

export function splitArchived<T extends Pick<SessionSummary, 'archived_at'>>(
  sessions: T[],
): SplitSessions<T> {
  const active: T[] = [];
  const archived: T[] = [];
  for (const s of sessions) (isArchived(s) ? archived : active).push(s);
  return { active, archived };
}

// Title / restaurant search, diacritic- and case-insensitive.
export function filterArchive<T extends Pick<SessionSummary, 'title' | 'restaurant_name'>>(
  sessions: T[],
  query: string,
): T[] {
  const q = fold(query.trim());
  if (q === '') return sessions;
  return sessions.filter(
    (s) => fold(s.title).includes(q) || fold(s.restaurant_name).includes(q),
  );
}

// True when at least one priced item is still unpaid (drives the confirm
// prompt before manual archiving).
export function hasOpenDues(items: { price_cents: number | null; paid_at: string | null }[]): boolean {
  return items.some((i) => i.price_cents !== null && i.paid_at === null);
}
