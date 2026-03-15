// hooks/useVehicles.ts
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

import { Vehicle, VehicleForm } from '@/types/vehicle';

interface UseVehiclesReturn {
  vehicles: Vehicle[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addVehicle: (form: VehicleForm) => Promise<Vehicle>;
  updateVehicle: (id: string, form: Partial<VehicleForm>) => Promise<Vehicle>;
  deleteVehicle: (id: string) => Promise<void>;
  scanPlate: (imageBase64: string) => Promise<string>;
}

export function useVehicles(): UseVehiclesReturn {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await axios.get<Vehicle[]>('/api/vehicles');
      setVehicles(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addVehicle = async (form: VehicleForm): Promise<Vehicle> => {
    const res = await axios.post<Vehicle>('/api/vehicles', form);
    setVehicles(prev => [res.data, ...prev]);
    return res.data;
  };

  const updateVehicle = async (id: string, form: Partial<VehicleForm>): Promise<Vehicle> => {
    const res = await axios.put<Vehicle>(`/api/vehicles/${id}`, form);
    setVehicles(prev => prev.map(v => (v._id === id ? res.data : v)));
    return res.data;
  };

  const deleteVehicle = async (id: string): Promise<void> => {
    await axios.delete(`/api/vehicles/${id}`);
    setVehicles(prev => prev.filter(v => v._id !== id));
  };

  const scanPlate = async (imageBase64: string): Promise<string> => {
    const res = await axios.post<{ plate: string }>('/api/vehicles/ocr-plate', { imageBase64 });
    return res.data.plate ?? '';
  };

  return { vehicles, loading, error, refresh, addVehicle, updateVehicle, deleteVehicle, scanPlate };
}
