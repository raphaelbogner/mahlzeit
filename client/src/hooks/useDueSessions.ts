import { useEffect, useState } from 'react';
import { listSessions } from '../api/sessions';
import type { SessionSummary } from '../types/api';

const POLL_INTERVAL_MS = 30_000;

// Lightweight list poll for the header due pill on pages that do not already
// hold the session list. Pass `enabled: false` to reuse a list from the page.
export function useDueSessions(userId: string, enabled: boolean): SessionSummary[] {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    const tick = async (): Promise<void> => {
      try {
        const data = await listSessions(controller.signal, userId);
        if (!cancelled) setSessions(data);
      } catch {
        // Keep the last known state; the pill is informational only.
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, [userId, enabled]);

  return sessions;
}
