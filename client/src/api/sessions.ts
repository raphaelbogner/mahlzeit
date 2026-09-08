import type {
  CreateSessionInput,
  DeleteSessionInput,
  Session,
  SessionsListResponse,
  SessionSummary,
  UpdateSessionInput,
} from '../types/api';
import { apiRequest } from './client';

// With userId the server adds person_totals for closed sessions (due overview).
export async function listSessions(
  signal?: AbortSignal,
  userId?: string,
): Promise<SessionSummary[]> {
  const path = userId ? `/sessions?user_id=${encodeURIComponent(userId)}` : '/sessions';
  const res = await apiRequest<SessionsListResponse>(path, { signal });
  return res.sessions;
}

// With userId the response includes my_declined ("Heute nicht dabei").
export async function getSession(
  id: string,
  signal?: AbortSignal,
  userId?: string,
): Promise<Session> {
  const path = userId
    ? `/sessions/${encodeURIComponent(id)}?user_id=${encodeURIComponent(userId)}`
    : `/sessions/${encodeURIComponent(id)}`;
  return apiRequest<Session>(path, { signal });
}

export async function createSession(input: CreateSessionInput): Promise<Session> {
  return apiRequest<Session>('/sessions', { method: 'POST', body: input });
}

export async function updateSession(
  id: string,
  input: UpdateSessionInput,
): Promise<Session> {
  return apiRequest<Session>(`/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function deleteSession(id: string, input: DeleteSessionInput): Promise<void> {
  await apiRequest<void>(`/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: input,
  });
}
