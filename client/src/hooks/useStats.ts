import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getStats } from '../api/stats';
import type { StatsRange, StatsResponse } from '../types/api';

export interface UseStatsResult {
  stats: StatsResponse | null;
  loading: boolean;
  error: ApiError | null;
}

export function useStats(range: StatsRange, userId: string): UseStatsResult {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await getStats(range, userId, controller.signal);
        if (cancelled) return;
        setStats(data);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [range, userId]);

  return { stats, loading, error };
}
