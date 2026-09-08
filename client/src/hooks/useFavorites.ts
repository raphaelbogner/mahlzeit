import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { listFavorites, setFavorite } from '../api/favorites';
import { useToast } from '../components/Toast';

export interface UseFavoritesResult {
  favoriteIds: Set<string>;
  toggle: (dishId: string) => void;
}

// Favorites of one user for one restaurant. Toggling is optimistic and
// rolled back with an error toast if the server rejects it.
export function useFavorites(restaurantId: string | null, userId: string): UseFavoritesResult {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const { showError } = useToast();

  useEffect(() => {
    if (restaurantId === null) return;
    let cancelled = false;
    const controller = new AbortController();
    listFavorites(userId, restaurantId, controller.signal)
      .then((ids) => {
        if (!cancelled) setFavoriteIds(new Set(ids));
      })
      .catch(() => {
        // Favorites are a convenience; keep the picker usable without them.
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [restaurantId, userId]);

  const toggle = useCallback(
    (dishId: string): void => {
      let next = false;
      setFavoriteIds((current) => {
        const copy = new Set(current);
        if (copy.has(dishId)) copy.delete(dishId);
        else {
          copy.add(dishId);
          next = true;
        }
        return copy;
      });
      // `next` is decided inside the updater; read it after React ran it.
      queueMicrotask(() => {
        setFavorite(dishId, userId, next).catch((err: unknown) => {
          setFavoriteIds((current) => {
            const copy = new Set(current);
            if (next) copy.delete(dishId);
            else copy.add(dishId);
            return copy;
          });
          showError(err instanceof ApiError ? err.message : 'Favorit konnte nicht gespeichert werden.');
        });
      });
    },
    [userId, showError],
  );

  return { favoriteIds, toggle };
}
