/**
 * hooks/useWorkers.ts
 *
 * Fetch the worker roster from /api/workers.
 * Includes clock-in state and optional live location.
 *
 * Usage:
 *   const { workers, loading, error, refresh } = useWorkers();
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { cacheGet, cacheSet } from '@/utils/db';

export interface Worker {
  _id:         string;
  name:        string;
  email:       string;
  phone?:      string;
  role:        'staff' | 'admin';
  clockedIn:   boolean;
  hourlyRate?: number;
  avatar?:     string;
  location?:   { lat: number; lng: number; updatedAt: string } | null;
  businessId?: string;
}

interface UseWorkersReturn {
  workers: Worker[];
  loading: boolean;
  error:   string | null;
  refresh: (showLoading?: boolean) => Promise<void>;
}

export function useWorkers(): UseWorkersReturn {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const cached = await cacheGet<Worker[]>('workers_list');
      if (cached) setWorkers(cached);

      const data = await api.get<Worker[]>('/api/workers');
      setWorkers(data ?? []);
      await cacheSet('workers_list', data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load workers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { workers, loading, error, refresh };
}
