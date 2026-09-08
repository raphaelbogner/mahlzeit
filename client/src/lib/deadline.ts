export type DeadlineUrgency = 'none' | 'soon' | 'critical' | 'passed';

export const SOON_MS = 15 * 60 * 1000;
export const CRITICAL_MS = 5 * 60 * 1000;

const clock = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' });
const dayMonth = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit' });

export function parseDeadline(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function deadlineUrgency(deadline: Date, now: Date): DeadlineUrgency {
  const remaining = deadline.getTime() - now.getTime();
  if (remaining <= 0) return 'passed';
  if (remaining <= CRITICAL_MS) return 'critical';
  if (remaining <= SOON_MS) return 'soon';
  return 'none';
}

export function formatClock(d: Date): string {
  return clock.format(d);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Human-readable remaining time, e.g. "in 42 min", "in 3 h 05 min",
// "morgen um 11:30", "am 12.09. um 11:30". Past deadlines: "um 11:30".
export function formatDeadline(deadline: Date, now: Date): string {
  const remaining = deadline.getTime() - now.getTime();
  const time = formatClock(deadline);
  if (remaining <= 0) return `um ${time}`;

  const minutes = Math.ceil(remaining / 60_000);
  if (minutes < 60) return `in ${minutes} min · ${time}`;

  if (isSameLocalDay(deadline, now)) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `in ${h} h ${m.toString().padStart(2, '0')} min · ${time}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameLocalDay(deadline, tomorrow)) return `morgen um ${time}`;

  return `am ${dayMonth.format(deadline)} um ${time}`;
}

// Build a Date for "today or tomorrow at HH:MM" in local time.
export function atLocalTime(day: Date, hhmm: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hours = Number.parseInt(m[1]!, 10);
  const minutes = Number.parseInt(m[2]!, 10);
  if (hours > 23 || minutes > 59) return null;
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// Fixed-time chip ("11:30"): today, or tomorrow if that time already passed.
export function nextOccurrence(hhmm: string, now: Date): Date | null {
  const today = atLocalTime(now, hhmm);
  if (!today) return null;
  if (today.getTime() > now.getTime()) return today;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return atLocalTime(tomorrow, hhmm);
}

export function addMinutes(now: Date, minutes: number): Date {
  const d = new Date(now.getTime() + minutes * 60_000);
  d.setSeconds(0, 0);
  return d;
}

// "HH:MM" for <input type="time">.
export function toTimeInputValue(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}
