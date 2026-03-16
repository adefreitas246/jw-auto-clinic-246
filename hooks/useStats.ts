/**
 * hooks/useStats.ts
 *
 * Fetch today's KPI stats from /api/reports/today.
 * Used on the admin home/dashboard screen.
 *
 * Usage:
 *   const { stats, loading, error, refresh } = useStats();
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { cacheGet, cacheSet } from '@/utils/db';

export interface TodayStats {
  bookingsToday:  number;
  revenueToday:   number;
  activeJobs:     number;
  staffOnline:    number;
  completedToday: number;
}

interface UseStatsReturn {
  stats:   TodayStats | null;
  loading: boolean;
  error:   string | null;
  refresh: (showLoading?: boolean) => Promise<void>;
}

const EMPTY_STATS: TodayStats = {
  bookingsToday:  0,
  revenueToday:   0,
  activeJobs:     0,
  staffOnline:    0,
  completedToday: 0,
};

export function useStats(): UseStatsReturn {
  const [stats,   setStats]   = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const cached = await cacheGet<TodayStats>('stats_today', 60_000); // 1-min TTL
      if (cached) setStats(cached);

      const data = await api.get<TodayStats>('/api/reports/today');
      setStats(data ?? EMPTY_STATS);
      await cacheSet('stats_today', data ?? EMPTY_STATS);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load stats');
      if (!stats) setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, error, refresh };
}
