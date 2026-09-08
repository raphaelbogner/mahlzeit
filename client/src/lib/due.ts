import type { PersonTotalRow, SessionSummary } from '../types/api';
import { clampDiscount, distributeDiscount } from './aggregate';

export type DueState = 'none' | 'open' | 'reported' | 'paid';

export interface DueInfo {
  gross_cents: number;
  unpaid_cents: number;
  reported_cents: number;
  discount_share_cents: number;
  // What the viewer still has to transfer: unpaid minus their full discount
  // share, never below zero (partial payments are treated generously).
  due_cents: number;
  state: DueState;
}

const NONE: DueInfo = {
  gross_cents: 0,
  unpaid_cents: 0,
  reported_cents: 0,
  discount_share_cents: 0,
  due_cents: 0,
  state: 'none',
};

type DueSession = Pick<
  SessionSummary,
  'status' | 'archived_at' | 'discount_cents' | 'paid_by_user_id' | 'creator_id'
> & { person_totals?: PersonTotalRow[] };

// The viewer's position in one session. Payers, open sessions and archived
// sessions never produce a due amount.
export function computeMyDue(session: DueSession, myUserId: string): DueInfo {
  if (session.status !== 'closed' || session.archived_at !== null) return NONE;
  const payerId = session.paid_by_user_id ?? session.creator_id;
  if (payerId === myUserId) return NONE;
  const rows = session.person_totals ?? [];
  const mine = rows.find((r) => r.user_id === myUserId);
  if (!mine || mine.total_cents <= 0) return NONE;

  const grandTotal = rows.reduce((sum, r) => sum + r.total_cents, 0);
  const shares = rows.map((r) => ({ ...r, discount_cents: 0 }));
  distributeDiscount(
    shares,
    grandTotal,
    clampDiscount(session.discount_cents, grandTotal),
    (r) => r.user_id,
  );
  const share = shares.find((r) => r.user_id === myUserId)?.discount_cents ?? 0;

  const due = Math.max(0, mine.unpaid_cents - share);
  let state: DueState = 'open';
  if (mine.unpaid_cents === 0) state = 'paid';
  else if (mine.reported_cents > 0 && mine.reported_cents === mine.unpaid_cents) state = 'reported';

  return {
    gross_cents: mine.total_cents,
    unpaid_cents: mine.unpaid_cents,
    reported_cents: mine.reported_cents,
    discount_share_cents: share,
    due_cents: due,
    state,
  };
}

export interface DueEntry<T> {
  session: T;
  due: DueInfo;
}

export interface DueOverview<T> {
  total_cents: number;
  entries: DueEntry<T>[];
}

// Everything the viewer still owes across non-archived closed sessions,
// open amounts first. Reported-but-unconfirmed amounts still count as due.
export function collectDue<T extends DueSession>(sessions: T[], myUserId: string): DueOverview<T> {
  const entries: DueEntry<T>[] = [];
  let total = 0;
  for (const session of sessions) {
    const due = computeMyDue(session, myUserId);
    if (due.due_cents > 0) {
      entries.push({ session, due });
      total += due.due_cents;
    }
  }
  return { total_cents: total, entries };
}
