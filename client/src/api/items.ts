import type {
  AddFreeTextItemInput,
  AddStructuredItemInput,
  DeleteItemInput,
  Item,
  ItemsResponse,
  MarkPersonPaidInput,
  ReportOwnPaymentInput,
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

// Payer marks every priced item of one person as (un)paid in one request.
export async function markPersonPaid(
  sessionId: string,
  input: MarkPersonPaidInput,
): Promise<Item[]> {
  const res = await apiRequest<ItemsResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/items/mark-paid`,
    { method: 'POST', body: input },
  );
  return res.items;
}

// Orderer reports "I transferred" for all their still-unpaid items.
export async function reportOwnPayment(
  sessionId: string,
  input: ReportOwnPaymentInput,
): Promise<Item[]> {
  const res = await apiRequest<ItemsResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/items/report`,
    { method: 'POST', body: input },
  );
  return res.items;
}
