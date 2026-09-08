import type { StatsRange } from '../types/api';

export const STATS_RANGES: { value: StatsRange; label: string }[] = [
  { value: '30d', label: '30 Tage' },
  { value: 'year', label: 'Dieses Jahr' },
  { value: 'all', label: 'Gesamt' },
];

export function rangeLabel(range: StatsRange): string {
  return STATS_RANGES.find((r) => r.value === range)?.label ?? range;
}

// Bar width in percent relative to the largest value; never below a sliver
// so tiny values remain visible, never above 100.
export function barWidth(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, Math.max(3, Math.round((value / max) * 100)));
}

export function maxOf<T>(rows: T[], pick: (row: T) => number): number {
  let max = 0;
  for (const r of rows) max = Math.max(max, pick(r));
  return max;
}
