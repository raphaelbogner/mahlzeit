import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { listSessions } from '../api/sessions';
import type { SessionSummary } from '../types/api';

const POLL_INTERVAL_MS = 5000;

export interface UseSessionsResult {
  sessions: SessionSummary[];
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

export function useSessions(userId?: string): UseSessionsResult {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const refresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    let hasData = false;
    const tick = async (isFirst: boolean) => {
      if (isFirst) setLoading(true);
      try {
        const data = await listSessions(controller.signal, userId);
        if (cancelled) return;
        setSessions(data);
        hasData = true;
        setError((current) => (current === null ? current : null));
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && !hasData) {
          setError((current) => (current?.message === e.message ? current : e));
        }
      } finally {
        if (!cancelled && isFirst) setLoading(false);
      }
    };

    void tick(true);
    const interval = window.setInterval(() => void tick(false), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refreshTick, userId]);

  return { sessions, loading, error, refresh };
}
