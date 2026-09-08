import { describe, it, expect } from 'vitest';
import { collectDue, computeMyDue } from './due';
import type { PersonTotalRow } from '../types/api';

const me = 'user000000000001';
const other = 'user000000000002';
const payer = 'user000000000009';

function row(user_id: string, total: number, unpaid = total, reported = 0): PersonTotalRow {
  return { user_id, user_name: user_id, total_cents: total, unpaid_cents: unpaid, reported_cents: reported };
}

function session(partial: {
  status?: 'open' | 'closed';
  archived_at?: string | null;
  discount_cents?: number;
  paid_by_user_id?: string | null;
  person_totals?: PersonTotalRow[];
}) {
  return {
    status: partial.status ?? 'closed',
    archived_at: partial.archived_at ?? null,
    discount_cents: partial.discount_cents ?? 0,
    paid_by_user_id: partial.paid_by_user_id ?? null,
    creator_id: payer,
    person_totals: partial.person_totals ?? [],
  } as const;
}

describe('computeMyDue', () => {
  it('is none for open or archived sessions, payers and people without items', () => {
    const rows = [row(me, 1000)];
    expect(computeMyDue(session({ status: 'open', person_totals: rows }), me).state).toBe('none');
    expect(
      computeMyDue(session({ archived_at: '2026-08-01T00:00:00Z', person_totals: rows }), me).state,
    ).toBe('none');
    expect(computeMyDue(session({ person_totals: rows }), payer).state).toBe('none');
    expect(computeMyDue(session({ person_totals: rows }), other).state).toBe('none');
  });

  it('returns the full unpaid amount without discount', () => {
    const due = computeMyDue(session({ person_totals: [row(me, 1000), row(other, 500)] }), me);
    expect(due.due_cents).toBe(1000);
    expect(due.state).toBe('open');
  });

  it('subtracts the exact proportional discount share', () => {
    const due = computeMyDue(
      session({ discount_cents: 600, person_totals: [row(me, 2000), row(other, 1200), row(payer, 800)] }),
      me,
    );
    expect(due.discount_share_cents).toBe(300);
    expect(due.due_cents).toBe(1700);
  });

  it('applies the whole discount share to the remaining unpaid part, never below zero', () => {
    const due = computeMyDue(
      session({ discount_cents: 600, person_totals: [row(me, 2000, 200), row(other, 2000)] }),
      me,
    );
    expect(due.discount_share_cents).toBe(300);
    expect(due.due_cents).toBe(0);
    expect(due.state).toBe('open');
  });

  it('reports paid and reported states', () => {
    expect(computeMyDue(session({ person_totals: [row(me, 1000, 0)] }), me).state).toBe('paid');
    expect(computeMyDue(session({ person_totals: [row(me, 1000, 1000, 1000)] }), me).state).toBe(
      'reported',
    );
    expect(computeMyDue(session({ person_totals: [row(me, 1000, 1000, 400)] }), me).state).toBe('open');
  });
});

describe('collectDue', () => {
  it('sums due amounts across sessions and skips settled ones', () => {
    const overview = collectDue(
      [
        { ...session({ person_totals: [row(me, 1000)] }), id: 'a' },
        { ...session({ person_totals: [row(me, 500, 0)] }), id: 'b' },
        { ...session({ person_totals: [row(me, 700, 700, 700)] }), id: 'c' },
      ],
      me,
    );
    expect(overview.total_cents).toBe(1700);
    expect(overview.entries.map((e) => e.session.id)).toEqual(['a', 'c']);
  });
});
