import type {
  MenuReplaceInput,
  Restaurant,
  RestaurantSummary,
} from '../types/api';
import { apiRequest } from './client';

interface RestaurantsListResponse {
  restaurants: RestaurantSummary[];
}

export async function listRestaurants(signal?: AbortSignal): Promise<RestaurantSummary[]> {
  const res = await apiRequest<RestaurantsListResponse>('/restaurants', { signal });
  return res.restaurants;
}

export async function getRestaurant(id: string, signal?: AbortSignal): Promise<Restaurant> {
  return apiRequest<Restaurant>(`/restaurants/${encodeURIComponent(id)}`, { signal });
}

export async function createRestaurant(name: string): Promise<Restaurant> {
  return apiRequest<Restaurant>('/restaurants', {
    method: 'POST',
    body: { name },
  });
}

export async function renameRestaurant(id: string, name: string): Promise<Restaurant> {
  return apiRequest<Restaurant>(`/restaurants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { name },
  });
}

export async function deleteRestaurant(id: string): Promise<void> {
  await apiRequest<void>(`/restaurants/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function replaceMenu(
  id: string,
  input: MenuReplaceInput,
): Promise<Restaurant> {
  return apiRequest<Restaurant>(`/restaurants/${encodeURIComponent(id)}/menu`, {
    method: 'PUT',
    body: input,
  });
}
