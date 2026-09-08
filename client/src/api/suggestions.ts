import type { ReorderSuggestion, SuggestionsResponse } from '../types/api';
import { apiRequest } from './client';

export async function listSuggestions(
  sessionId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<ReorderSuggestion[]> {
  const res = await apiRequest<SuggestionsResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/suggestions?user_id=${encodeURIComponent(userId)}`,
    { signal },
  );
  return res.suggestions;
}
