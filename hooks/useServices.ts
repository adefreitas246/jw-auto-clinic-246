/**
 * hooks/useServices.ts
 *
 * Admin-facing service management hook (CRUD on /api/services).
 * For the catalog (customer-facing read-only view) use useServiceCatalog instead.
 *
 * Usage:
 *   const { services, loading, error, refresh, createService, updateService, deleteService } = useServices();
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { cacheGet, cacheSet } from '@/utils/db';

export interface Service {
  _id:         string;
  name:        string;
  category?:   string;
  description?: string;
  price:       number;
  duration?:   number;
  active:      boolean;
  imageUrl?:   string;
  businessId?: string;
}

interface UseServicesReturn {
  services:       Service[];
  loading:        boolean;
  error:          string | null;
  refresh:        (showLoading?: boolean) => Promise<void>;
  createService:  (data: Partial<Service>) => Promise<Service>;
  updateService:  (id: string, data: Partial<Service>) => Promise<Service>;
  deleteService:  (id: string) => Promise<void>;
  toggleActive:   (service: Service, active: boolean) => Promise<void>;
}

export function useServices(): UseServicesReturn {
  const [services, setServices] = useState<Service[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const cached = await cacheGet<Service[]>('services_admin');
      if (cached) setServices(cached);

      const data = await api.get<Service[]>('/api/services');
      setServices(data ?? []);
      await cacheSet('services_admin', data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createService = useCallback(async (data: Partial<Service>): Promise<Service> => {
    const result = await api.post<Service>('/api/services', data);
    await refresh(false);
    return result;
  }, [refresh]);

  const updateService = useCallback(async (id: string, data: Partial<Service>): Promise<Service> => {
    const result = await api.put<Service>(`/api/services/${id}`, data);
    setServices(prev => prev.map(s => s._id === id ? result : s));
    return result;
  }, []);

  const deleteService = useCallback(async (id: string) => {
    await api.delete(`/api/services/${id}`);
    setServices(prev => prev.filter(s => s._id !== id));
  }, []);

  const toggleActive = useCallback(async (service: Service, active: boolean) => {
    const result = await api.patch<Service>(`/api/services/${service._id}`, { active });
    setServices(prev => prev.map(s => s._id === service._id ? result : s));
  }, []);

  return { services, loading, error, refresh, createService, updateService, deleteService, toggleActive };
}
