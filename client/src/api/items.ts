import type {
  AddFreeTextItemInput,
  AddStructuredItemInput,
  DeleteItemInput,
  Item,
  UpdateItemInput,
} from '../types/api';
import { apiRequest } from './client';

export async function addFreeTextItem(
  sessionId: string,
  input: AddFreeTextItemInput,
): Promise<Item> {
  return apiRequest<Item>(`/sessions/${encodeURIComponent(sessionId)}/items`, {
    method: 'POST',
    body: input,
  });
}

export async function addStructuredItem(
  sessionId: string,
  input: AddStructuredItemInput,
): Promise<Item> {
  return apiRequest<Item>(`/sessions/${encodeURIComponent(sessionId)}/items`, {
    method: 'POST',
    body: input,
  });
}

export async function updateItem(
  sessionId: string,
  itemId: string,
  input: UpdateItemInput,
): Promise<Item> {
  return apiRequest<Item>(
    `/sessions/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: input },
  );
}

export async function deleteItem(
  sessionId: string,
  itemId: string,
  input: DeleteItemInput,
): Promise<void> {
  await apiRequest<void>(
    `/sessions/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE', body: input },
  );
}
