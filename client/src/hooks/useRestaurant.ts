import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getRestaurant } from '../api/restaurants';
import type { Restaurant } from '../types/api';

export interface UseRestaurantResult {
  restaurant: Restaurant | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
  setRestaurant: (next: Restaurant) => void;
}

export function useRestaurant(id: string | undefined): UseRestaurantResult {
  const [restaurant, setRestaurantState] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);
  const setRestaurant = useCallback((next: Restaurant) => setRestaurantState(next), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      if (!id) {
        setRestaurantState(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getRestaurant(id, controller.signal);
        if (cancelled) return;
        setRestaurantState(data);
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
  }, [id, refreshTick]);

  return { restaurant, loading, error, refresh, setRestaurant };
}
