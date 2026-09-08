import { describe, it, expect } from 'vitest';
import {
  addMinutes,
  atLocalTime,
  deadlineUrgency,
  formatDeadline,
  nextOccurrence,
  parseDeadline,
  toTimeInputValue,
} from './deadline';

// Local-time base so the "same day / tomorrow" logic is deterministic in any
// runner timezone.
const now = new Date(2026, 8, 8, 10, 0, 0, 0); // 8 Sep 2026 10:00 local

describe('parseDeadline', () => {
  it('parses ISO strings and rejects garbage', () => {
    expect(parseDeadline('2026-09-08T09:30:00Z')?.getTime()).toBe(Date.UTC(2026, 8, 8, 9, 30));
    expect(parseDeadline(null)).toBeNull();
    expect(parseDeadline('')).toBeNull();
    expect(parseDeadline('nope')).toBeNull();
  });
});

describe('deadlineUrgency', () => {
  it('maps remaining time to urgency levels with inclusive thresholds', () => {
    expect(deadlineUrgency(addMinutes(now, 60), now)).toBe('none');
    expect(deadlineUrgency(addMinutes(now, 16), now)).toBe('none');
    expect(deadlineUrgency(addMinutes(now, 15), now)).toBe('soon');
    expect(deadlineUrgency(addMinutes(now, 6), now)).toBe('soon');
    expect(deadlineUrgency(addMinutes(now, 5), now)).toBe('critical');
    expect(deadlineUrgency(addMinutes(now, 1), now)).toBe('critical');
    expect(deadlineUrgency(now, now)).toBe('passed');
    expect(deadlineUrgency(addMinutes(now, -10), now)).toBe('passed');
  });
});

describe('formatDeadline', () => {
  it('shows minutes when under an hour', () => {
    expect(formatDeadline(addMinutes(now, 42), now)).toMatch(/^in 42 min · \d{2}:\d{2}$/);
  });

  it('shows hours and minutes for later today', () => {
    expect(formatDeadline(addMinutes(now, 185), now)).toMatch(/^in 3 h 05 min · \d{2}:\d{2}$/);
  });

  it('says "morgen" for tomorrow and a date further out', () => {
    const tomorrow = new Date(2026, 8, 9, 11, 30);
    expect(formatDeadline(tomorrow, now)).toMatch(/^morgen um \d{2}:\d{2}$/);
    const later = new Date(2026, 8, 12, 11, 30);
    expect(formatDeadline(later, now)).toMatch(/^am 12\.09\. um \d{2}:\d{2}$/);
  });

  it('shows only the time once passed', () => {
    expect(formatDeadline(addMinutes(now, -5), now)).toMatch(/^um \d{2}:\d{2}$/);
  });
});

describe('atLocalTime / nextOccurrence', () => {
  it('builds a local time on the given day', () => {
    const d = atLocalTime(now, '11:30')!;
    expect(d.getHours()).toBe(11);
    expect(d.getMinutes()).toBe(30);
    expect(d.getDate()).toBe(8);
  });

  it('rejects invalid input', () => {
    expect(atLocalTime(now, '25:00')).toBeNull();
    expect(atLocalTime(now, 'abc')).toBeNull();
  });

  it('rolls a passed fixed time over to tomorrow', () => {
    expect(nextOccurrence('11:30', now)!.getDate()).toBe(8);
    expect(nextOccurrence('09:00', now)!.getDate()).toBe(9);
  });
});

describe('addMinutes / toTimeInputValue', () => {
  it('adds minutes and drops seconds', () => {
    const d = addMinutes(new Date(2026, 8, 8, 10, 0, 45), 30);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(0);
  });

  it('formats HH:MM for the time input', () => {
    expect(toTimeInputValue(new Date(2026, 8, 8, 9, 5))).toBe('09:05');
  });
});
