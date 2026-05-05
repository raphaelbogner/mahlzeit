import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { listRestaurants } from '../api/restaurants';
import type { RestaurantSummary } from '../types/api';

export interface UseRestaurantsResult {
  restaurants: RestaurantSummary[];
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

export function useRestaurants(): UseRestaurantsResult {
  const [restaurants, setRestaurants] = useState<RestaurantSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await listRestaurants(controller.signal);
        if (cancelled) return;
        setRestaurants(data);
        setError((current) => (current === null ? current : null));
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) {
          setError((current) => (current?.message === e.message ? current : e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshTick]);

  return { restaurants, loading, error, refresh };
}
