import type { CreateOptionTemplateInput, OptionTemplate } from '../types/api';
import { apiRequest } from './client';

interface TemplatesListResponse {
  templates: OptionTemplate[];
}

export async function listOptionTemplates(signal?: AbortSignal): Promise<OptionTemplate[]> {
  const res = await apiRequest<TemplatesListResponse>('/option-templates', { signal });
  return res.templates;
}

export async function createOptionTemplate(
  input: CreateOptionTemplateInput,
): Promise<OptionTemplate> {
  return apiRequest<OptionTemplate>('/option-templates', {
    method: 'POST',
    body: input,
  });
}

export async function deleteOptionTemplate(id: string): Promise<void> {
  await apiRequest<void>(`/option-templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
