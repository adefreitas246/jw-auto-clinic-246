/**
 * hooks/useQueue.ts
 *
 * Fetch the walk-in queue from /api/queue.
 * Auto-refreshes every 15 seconds while mounted.
 *
 * Usage:
 *   const { entries, loading, error, refresh, addEntry, removeEntry } = useQueue();
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/utils/api';

export type QueueStatus = 'waiting' | 'called' | 'in_service' | 'completed' | 'skipped' | 'cancelled';

export interface QueueEntry {
  _id:            string;
  guestName:      string;
  phone?:         string;
  vehicleDetails?: string;
  serviceType?:   string;
  status:         QueueStatus;
  position?:      number | null;
  estimatedWait?: number | null;
  joinedAt:       string;
}

interface WalkInPayload {
  guestName:      string;
  phone?:         string;
  vehicleDetails?: string;
  serviceType?:   string;
}

interface UseQueueReturn {
  entries:     QueueEntry[];
  loading:     boolean;
  error:       string | null;
  refresh:     () => Promise<void>;
  addEntry:    (payload: WalkInPayload) => Promise<void>;
  callNext:    () => Promise<void>;
  updateStatus: (id: string, status: QueueStatus) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

const REFRESH_INTERVAL_MS = 15_000;

export function useQueue(): UseQueueReturn {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<QueueEntry[]>('/api/queue');
      setEntries(data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  const addEntry = useCallback(async (payload: WalkInPayload) => {
    await api.post('/api/queue', payload);
    await refresh();
  }, [refresh]);

  const callNext = useCallback(async () => {
    await api.post('/api/queue/call-next', {});
    await refresh();
  }, [refresh]);

  const updateStatus = useCallback(async (id: string, status: QueueStatus) => {
    await api.patch(`/api/queue/${id}/status`, { status });
    await refresh();
  }, [refresh]);

  const removeEntry = useCallback(async (id: string) => {
    await api.delete(`/api/queue/${id}`);
    setEntries(prev => prev.filter(e => e._id !== id));
  }, []);

  return { entries, loading, error, refresh, addEntry, callNext, updateStatus, removeEntry };
}
