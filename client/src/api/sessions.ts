import type {
  CreateSessionInput,
  DeleteSessionInput,
  Session,
  SessionsListResponse,
  SessionSummary,
  UpdateSessionInput,
} from '../types/api';
import { apiRequest } from './client';

export async function listSessions(signal?: AbortSignal): Promise<SessionSummary[]> {
  const res = await apiRequest<SessionsListResponse>('/sessions', { signal });
  return res.sessions;
}

export async function getSession(id: string, signal?: AbortSignal): Promise<Session> {
  return apiRequest<Session>(`/sessions/${encodeURIComponent(id)}`, { signal });
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
