import { apiFetch } from './client'

export interface WorkspaceStats {
  sessions_total: number
  sessions_open: number
  items_total: number
  restaurants_total: number
  last_activity: string | null
}

export interface WorkspaceSummary {
  id: number
  name: string
  token: string
  url: string
  created_at: string
  stats: WorkspaceStats
}

export interface ActiveUser {
  name: string
  first_seen: string | null
  last_seen: string | null
  items_count: number
}

export interface WorkspaceDetail extends WorkspaceSummary {
  active_users: ActiveUser[]
}

export async function listWorkspaces(signal?: AbortSignal): Promise<WorkspaceSummary[]> {
  const res = await apiFetch<{ workspaces: WorkspaceSummary[] }>('/admin/api/workspaces', {
    signal,
  })
  return res.workspaces
}

export async function createWorkspace(name: string): Promise<WorkspaceDetail> {
  return apiFetch<WorkspaceDetail>('/admin/api/workspaces', {
    method: 'POST',
    body: { name },
  })
}

export async function getWorkspace(id: number, signal?: AbortSignal): Promise<WorkspaceDetail> {
  return apiFetch<WorkspaceDetail>(`/admin/api/workspaces/${id}`, { signal })
}

export async function renameWorkspace(id: number, name: string): Promise<WorkspaceDetail> {
  return apiFetch<WorkspaceDetail>(`/admin/api/workspaces/${id}`, {
    method: 'PATCH',
    body: { name },
  })
}

export async function rotateWorkspaceToken(id: number): Promise<WorkspaceDetail> {
  return apiFetch<WorkspaceDetail>(`/admin/api/workspaces/${id}/rotate`, {
    method: 'POST',
  })
}

export async function deleteWorkspace(id: number): Promise<void> {
  await apiFetch<void>(`/admin/api/workspaces/${id}`, { method: 'DELETE' })
}
