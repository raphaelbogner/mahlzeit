import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { listSuggestions } from '../api/suggestions';
import type { ReorderSuggestion } from '../types/api';

export interface UseSuggestionsResult {
  suggestions: ReorderSuggestion[];
  loading: boolean;
}

// Loads "order again" suggestions once per session/user. Sessions without a
// linked restaurant never have suggestions, so we skip the request entirely.
export function useSuggestions(
  sessionId: string,
  userId: string,
  restaurantId: string | null,
): UseSuggestionsResult {
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (restaurantId === null) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await listSuggestions(sessionId, userId, controller.signal);
        if (!cancelled) setSuggestions(data);
      } catch (e) {
        // Suggestions are a convenience; a failed load must not block ordering.
        if (!cancelled && !(e instanceof ApiError && e.code === 'NETWORK_ERROR')) {
          setSuggestions([]);
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
  }, [sessionId, userId, restaurantId]);

  if (restaurantId === null) {
    return { suggestions: [], loading: false };
  }
  return { suggestions, loading };
}
