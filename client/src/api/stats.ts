import type { StatsRange, StatsResponse } from '../types/api';
import { apiRequest } from './client';

export async function getStats(
  range: StatsRange,
  userId: string,
  signal?: AbortSignal,
): Promise<StatsResponse> {
  return apiRequest<StatsResponse>(
    `/stats?range=${encodeURIComponent(range)}&user_id=${encodeURIComponent(userId)}`,
    { signal },
  );
}
