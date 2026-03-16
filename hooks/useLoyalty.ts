/**
 * hooks/useLoyalty.ts
 *
 * Fetch loyalty account data from /api/loyalty.
 *
 * Usage:
 *   const { loyalty, loading, error, refresh, redeem } = useLoyalty();
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { cacheGet, cacheSet } from '@/utils/db';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold';

export interface LoyaltyHistoryEntry {
  _id:         string;
  type:        'earn' | 'redeem' | 'expire' | 'bonus';
  points:      number;
  description: string;
  createdAt:   string;
}

export interface LoyaltyConfig {
  pointsPerDollar:    number;
  redeemRate:         number;
  milestones:         { points: number; label: string; emoji: string }[];
  silverThreshold:    number;
  goldThreshold:      number;
  minRedeemPoints:    number;
}

export interface LoyaltyAccount {
  points:       number;
  totalEarned:  number;
  totalRedeemed:number;
  tier:         LoyaltyTier;
  history:      LoyaltyHistoryEntry[];
}

export interface LoyaltyData {
  account: LoyaltyAccount;
  config:  LoyaltyConfig;
}

interface UseLoyaltyReturn {
  loyalty:  LoyaltyData | null;
  loading:  boolean;
  error:    string | null;
  refresh:  (showLoading?: boolean) => Promise<void>;
  redeem:   (points: number) => Promise<void>;
}

export function useLoyalty(): UseLoyaltyReturn {
  const [loyalty,  setLoyalty]  = useState<LoyaltyData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const cached = await cacheGet<LoyaltyData>('loyalty_data', 2 * 60 * 1000);
      if (cached) setLoyalty(cached);

      const data = await api.get<LoyaltyData>('/api/loyalty');
      setLoyalty(data);
      await cacheSet('loyalty_data', data);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load loyalty data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const redeem = useCallback(async (points: number) => {
    await api.post('/api/loyalty/redeem', { points });
    await refresh(false);
  }, [refresh]);

  return { loyalty, loading, error, refresh, redeem };
}
