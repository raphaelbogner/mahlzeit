import { describe, it, expect } from 'vitest';
import { filterArchive, hasOpenDues, isArchived, splitArchived } from './archive';

describe('archive helpers', () => {
  it('splits sessions by archived_at', () => {
    const { active, archived } = splitArchived([
      { archived_at: null, id: 'a' },
      { archived_at: '2026-08-01T10:00:00Z', id: 'b' },
    ]);
    expect(active.map((s) => s.id)).toEqual(['a']);
    expect(archived.map((s) => s.id)).toEqual(['b']);
    expect(isArchived({ archived_at: null })).toBe(false);
  });

  it('filters by title or restaurant, ignoring case and diacritics', () => {
    const sessions = [
      { title: 'Dürüm Dienstag', restaurant_name: 'Kebap Haus' },
      { title: 'Pizza Freitag', restaurant_name: 'Roma' },
    ];
    expect(filterArchive(sessions, 'durum')).toHaveLength(1);
    expect(filterArchive(sessions, 'ROMA')).toHaveLength(1);
    expect(filterArchive(sessions, '')).toHaveLength(2);
    expect(filterArchive(sessions, 'sushi')).toHaveLength(0);
  });

  it('detects open dues only for priced, unpaid items', () => {
    expect(hasOpenDues([{ price_cents: 500, paid_at: null }])).toBe(true);
    expect(hasOpenDues([{ price_cents: 500, paid_at: '2026-09-01 10:00:00' }])).toBe(false);
    expect(hasOpenDues([{ price_cents: null, paid_at: null }])).toBe(false);
    expect(hasOpenDues([])).toBe(false);
  });
});
