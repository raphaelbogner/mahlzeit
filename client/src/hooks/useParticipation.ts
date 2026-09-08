import { useEffect, useState } from 'react';
import { getParticipation } from '../api/participation';
import type { ParticipationResponse } from '../types/api';

const POLL_INTERVAL_MS = 15_000;

// Creator/payer view of who still has to order. Polls while enabled (open
// session, authorised viewer); silent on errors, the panel is informational.
export function useParticipation(
  sessionId: string,
  userId: string,
  enabled: boolean,
): ParticipationResponse | null {
  const [data, setData] = useState<ParticipationResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    const tick = async (): Promise<void> => {
      try {
        const res = await getParticipation(sessionId, userId, controller.signal);
        if (!cancelled) setData(res);
      } catch {
        // keep last known state
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(id);
    };
  }, [sessionId, userId, enabled]);

  return enabled ? data : null;
}
