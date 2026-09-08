import type { ParticipationResponse } from '../types/api';
import { apiRequest } from './client';

export async function getParticipation(
  sessionId: string,
  userId: string,
  signal?: AbortSignal,
): Promise<ParticipationResponse> {
  return apiRequest<ParticipationResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/participation?user_id=${encodeURIComponent(userId)}`,
    { signal },
  );
}

export async function declineSession(
  sessionId: string,
  input: { user_id: string; user_name: string },
): Promise<void> {
  await apiRequest<{ declined: boolean }>(
    `/sessions/${encodeURIComponent(sessionId)}/decline`,
    { method: 'PUT', body: input },
  );
}

export async function undeclineSession(sessionId: string, input: { user_id: string }): Promise<void> {
  await apiRequest<{ declined: boolean }>(
    `/sessions/${encodeURIComponent(sessionId)}/decline`,
    { method: 'DELETE', body: input },
  );
}
