import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  createOptionTemplate,
  deleteOptionTemplate,
  listOptionTemplates,
} from '../api/templates';
import type { CreateOptionTemplateInput, OptionTemplate } from '../types/api';

export interface UseOptionTemplatesResult {
  templates: OptionTemplate[];
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
  create: (input: CreateOptionTemplateInput) => Promise<OptionTemplate>;
  remove: (id: string) => Promise<void>;
}

export function useOptionTemplates(): UseOptionTemplatesResult {
  const [templates, setTemplates] = useState<OptionTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const load = async (): Promise<void> => {
      setLoading(true);
      try {
        const data = await listOptionTemplates(controller.signal);
        if (cancelled) return;
        setTemplates(data);
        setError((current) => (current === null ? current : null));
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) {
          setError((current) => (current?.message === e.message ? current : e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshTick]);

  const create = useCallback(async (input: CreateOptionTemplateInput): Promise<OptionTemplate> => {
    const created = await createOptionTemplate(input);
    setTemplates((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteOptionTemplate(id);
    setTemplates((current) => current.filter((t) => t.id !== id));
  }, []);

  return { templates, loading, error, refresh, create, remove };
}
