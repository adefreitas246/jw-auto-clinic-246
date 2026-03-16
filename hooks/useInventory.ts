/**
 * hooks/useInventory.ts
 *
 * Fetch inventory from /api/inventory with SQLite offline fallback.
 * Wraps the lower-level useInventoryCache for the online-sync layer.
 *
 * Usage:
 *   const { items, loading, error, refresh, adjustStock } = useInventory();
 */
import { useCallback, useEffect, useState } from 'react';
import api from '@/utils/api';
import { useInventoryCache, CachedInventoryItem } from './useInventoryCache';

interface UseInventoryReturn {
  items:        CachedInventoryItem[];
  loading:      boolean;
  error:        string | null;
  isOffline:    boolean;
  refresh:      (showLoading?: boolean) => Promise<void>;
  adjustStock:  (id: string, delta: number) => Promise<void>;
  deleteItem:   (id: string) => Promise<void>;
}

export function useInventory(): UseInventoryReturn {
  const cache = useInventoryCache();

  const [items,     setItems]     = useState<CachedInventoryItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);

    try {
      const data = await api.get<any[]>('/api/inventory');
      await cache.saveAll(data ?? []);
      setItems(data ?? []);
      setIsOffline(false);
    } catch (e: any) {
      // Fall back to SQLite cache
      const cached = await cache.readAll();
      if (cached.length > 0) {
        setItems(cached);
        setIsOffline(true);
      } else {
        setError(e?.message ?? 'Failed to load inventory');
      }
    } finally {
      setLoading(false);
    }
  }, [cache]);

  useEffect(() => { refresh(); }, [refresh]);

  const adjustStock = useCallback(async (id: string, delta: number) => {
    const item = items.find(i => i._id === id);
    if (!item) return;
    const newStock = Math.max(0, item.currentStock + delta);
    await api.patch(`/api/inventory/${id}`, { currentStock: newStock });
    await cache.patchStock(id, newStock);
    setItems(prev => prev.map(i => i._id === id ? { ...i, currentStock: newStock } : i));
  }, [items, cache]);

  const deleteItem = useCallback(async (id: string) => {
    await api.delete(`/api/inventory/${id}`);
    await cache.remove(id);
    setItems(prev => prev.filter(i => i._id !== id));
  }, [cache]);

  return { items, loading, error, isOffline, refresh, adjustStock, deleteItem };
}
