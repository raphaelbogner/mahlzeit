import { apiRequest } from './client';

export interface PushConfig {
  enabled: boolean;
  public_key: string | null;
}

export async function getPushConfig(signal?: AbortSignal): Promise<PushConfig> {
  return apiRequest<PushConfig>('/push/config', { signal });
}

export interface PushSubscriptionInput {
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent?: string;
}

export async function savePushSubscription(input: PushSubscriptionInput): Promise<void> {
  await apiRequest<{ subscribed: boolean }>('/push/subscription', { method: 'PUT', body: input });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await apiRequest<{ subscribed: boolean }>('/push/subscription', {
    method: 'DELETE',
    body: { endpoint },
  });
}

export async function sendTestPush(userId: string): Promise<void> {
  await apiRequest<unknown>('/push/test', { method: 'POST', body: { user_id: userId } });
}
