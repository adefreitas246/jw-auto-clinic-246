/**
 * hooks/useBookings.ts
 *
 * Fetch bookings from the API with SQLite cache-first strategy.
 * Works for both customer (own bookings) and admin/staff (all bookings).
 *
 * Usage:
 *   const { bookings, loading, error, refresh } = useBookings();
 *   const { bookings } = useBookings('pending');   // filter by status
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { cacheGet, cacheSet } from '@/utils/db';

export interface Booking {
  _id:             string;
  status:          'pending' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'quality_check' | 'finished' | 'cancelled';
  serviceType?:    string;
  packageName?:    string;
  totalPrice:      number;
  finalPrice?:     number;
  appointmentDate: string;
  appointmentTime: string;
  locationType?:   'bay' | 'mobile';
  paymentMethod?:  string;
  customerName?:   string;
  vehicle?:        { make: string; model: string; licensePlate: string };
  worker?:         { name: string } | null;
  createdAt:       string;
  updatedAt:       string;
}

interface UseBookingsReturn {
  bookings: Booking[];
  loading:  boolean;
  error:    string | null;
  refresh:  (showLoading?: boolean) => Promise<void>;
}

export function useBookings(filter?: string): UseBookingsReturn {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    const cacheKey = `bookings_${filter ?? 'all'}`;

    try {
      // Show cached data immediately
      const cached = await cacheGet<Booking[]>(cacheKey);
      if (cached) setBookings(cached);

      // Fetch fresh
      const endpoint = filter ? `/api/bookings?status=${filter}` : '/api/bookings';
      const data = await api.get<Booking[]>(endpoint);
      setBookings(data ?? []);
      await cacheSet(cacheKey, data ?? []);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? 'Failed to load bookings';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { refresh(); }, [refresh]);

  return { bookings, loading, error, refresh };
}
