/**
 * hooks/useJobs.ts
 *
 * Fetch the staff job queue from /api/jobs.
 * Optionally fetch a single job by ID for the tracking screen.
 *
 * Usage:
 *   const { jobs, loading, error, refresh } = useJobs();
 *   const { job } = useSingleJob(jobId);
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { cacheGet, cacheSet } from '@/utils/db';

export type JobStatus =
  | 'assigned' | 'in_progress' | 'completed' | 'quality_check' | 'finished';

export interface Job {
  _id:             string;
  status:          JobStatus;
  bookingId?:      string;
  customerName?:   string;
  vehicle?:        { make: string; model: string; licensePlate: string };
  serviceType?:    string;
  packageName?:    string;
  locationType?:   'bay' | 'mobile';
  appointmentDate: string;
  appointmentTime: string;
  notes?:          string;
  workerName?:     string;
  createdAt:       string;
  updatedAt:       string;
}

interface UseJobsReturn {
  jobs:    Job[];
  loading: boolean;
  error:   string | null;
  refresh: (showLoading?: boolean) => Promise<void>;
  updateStatus: (id: string, status: JobStatus, notes?: string) => Promise<void>;
}

export function useJobs(): UseJobsReturn {
  const [jobs,    setJobs]    = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const cached = await cacheGet<Job[]>('jobs_list');
      if (cached) setJobs(cached);

      const data = await api.get<Job[]>('/api/jobs');
      setJobs(data ?? []);
      await cacheSet('jobs_list', data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const updateStatus = useCallback(async (id: string, status: JobStatus, notes?: string) => {
    await api.patch(`/api/jobs/${id}/status`, { status, ...(notes ? { notes } : {}) });
    await refresh(false);
  }, [refresh]);

  return { jobs, loading, error, refresh, updateStatus };
}

/** Fetch a single job by ID (for tracking/detail screens). */
export function useSingleJob(jobId: string | null) {
  const [job,     setJob]     = useState<Job | null>(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Job>(`/api/jobs/${jobId}`);
      setJob(data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load job');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { job, loading, error, refresh };
}
