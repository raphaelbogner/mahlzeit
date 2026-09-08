import type { FavoritesResponse } from '../types/api';
import { apiRequest } from './client';

export async function listFavorites(
  userId: string,
  restaurantId: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const res = await apiRequest<FavoritesResponse>(
    `/favorites?user_id=${encodeURIComponent(userId)}&restaurant_id=${encodeURIComponent(restaurantId)}`,
    { signal },
  );
  return res.dish_ids;
}

export async function setFavorite(dishId: string, userId: string, favorite: boolean): Promise<void> {
  await apiRequest<{ favorite: boolean }>(`/favorites/${encodeURIComponent(dishId)}`, {
    method: favorite ? 'PUT' : 'DELETE',
    body: { user_id: userId },
  });
}
