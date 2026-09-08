import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getSession } from '../api/sessions';
import type { Session } from '../types/api';

const POLL_INTERVAL_MS = 5000;

export interface UseSessionResult {
  session: Session | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
  setSession: (next: Session) => void;
}

export function useSession(id: string | undefined, userId?: string): UseSessionResult {
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const refresh = useCallback(() => {
    setRefreshTick((n) => n + 1);
  }, []);

  const setSession = useCallback((next: Session) => {
    setSessionState(next);
  }, []);

  useEffect(() => {
    if (!id) {
      setSessionState(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    let hasData = false;
    const tick = async (isFirst: boolean) => {
      if (isFirst) setLoading(true);
      try {
        const data = await getSession(id, controller.signal, userId);
        if (cancelled) return;
        setSessionState(data);
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
  }, [id, refreshTick, userId]);

  return { session, loading, error, refresh, setSession };
}
