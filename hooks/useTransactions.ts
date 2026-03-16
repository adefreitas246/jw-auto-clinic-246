/**
 * hooks/useTransactions.ts
 *
 * Fetch transaction history from /api/transactions.
 *
 * Usage:
 *   const { transactions, loading, error, refresh } = useTransactions();
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { cacheGet, cacheSet } from '@/utils/db';

export interface Transaction {
  _id:             string;
  serviceType?:    string;
  serviceName?:    string;
  finalPrice?:     number;
  originalPrice?:  number;
  discountAmount?: number;
  paymentMethod?:  string;
  customerName?:   string;
  vehicleDetails?: string;
  employeeName?:   string;
  notes?:          string;
  serviceDate?:    string;
  createdAt?:      string;
}

interface UseTransactionsReturn {
  transactions: Transaction[];
  loading:      boolean;
  error:        string | null;
  refresh:      (showLoading?: boolean) => Promise<void>;
}

export function useTransactions(): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const cached = await cacheGet<Transaction[]>('transactions_list');
      if (cached) setTransactions(cached);

      const data = await api.get<Transaction[]>('/api/transactions');
      setTransactions(data ?? []);
      await cacheSet('transactions_list', data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { transactions, loading, error, refresh };
}
