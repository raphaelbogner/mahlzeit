import { useNow } from '../hooks/useNow';
import { deadlineUrgency, formatClock, formatDeadline, parseDeadline } from '../lib/deadline';
import type { SessionStatus } from '../types/api';

export interface DeadlineBadgeProps {
  deadlineAt: string | null;
  // Legacy free-text deadline for sessions created before deadline_at existed.
  deadlineText: string;
  status: SessionStatus;
  autoClosed: boolean;
  // Compact variant for list cards (no leading label).
  compact?: boolean;
}

const urgencyClass: Record<'none' | 'soon' | 'critical', string> = {
  none: 'text-stone-600',
  soon: 'text-orange-700 font-medium',
  critical: 'text-rose-700 font-semibold',
};

export function DeadlineBadge({
  deadlineAt,
  deadlineText,
  status,
  autoClosed,
  compact,
}: DeadlineBadgeProps) {
  const deadline = parseDeadline(deadlineAt);
  const now = useNow(deadline && status === 'open' ? 30_000 : 0);

  if (status === 'closed') {
    if (autoClosed && deadline) {
      return (
        <span className="text-xs text-stone-500">
          automatisch geschlossen um {formatClock(deadline)}
        </span>
      );
    }
    return null;
  }

  if (deadline) {
    const urgency = deadlineUrgency(deadline, now);
    if (urgency === 'passed') {
      return (
        <span className="text-xs font-medium text-rose-700">
          Bestellschluss erreicht · wird geschlossen…
        </span>
      );
    }
    return (
      <span className={'text-xs tabular-nums ' + urgencyClass[urgency]}>
        <span aria-hidden="true">⏱ </span>
        {compact ? '' : 'Bestellschluss '}
        {formatDeadline(deadline, now)}
      </span>
    );
  }

  if (deadlineText.trim() !== '') {
    return <span className="text-xs text-stone-600">bis {deadlineText}</span>;
  }

  return null;
}
