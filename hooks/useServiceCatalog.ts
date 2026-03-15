/**
 * hooks/useServiceCatalog.ts
 *
 * Sync strategy:
 *   1. Check connectivity with expo-network.
 *   2. If ONLINE  → fetch /api/services/catalog + /api/packages/catalog
 *                 → upsert into SQLite
 *                 → return fresh data, isOffline: false
 *   3. If OFFLINE → read from SQLite cache
 *                 → return cached data, isOffline: true
 *   4. If ONLINE fetch fails → fall back to cache + set isOffline: true
 */
import * as Network from 'expo-network';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  getCachedPackages,
  getCachedServices,
  getLastSyncedAt,
  upsertPackages,
  upsertServices,
} from '@/db/catalogDb';
import { CatalogState, Package, Service } from '@/types/catalog';

export function useServiceCatalog(): CatalogState {
  const { user } = useAuth();

  const [services, setServices]           = useState<Service[]>([]);
  const [packages, setPackages]           = useState<Package[]>([]);
  const [isOffline, setIsOffline]         = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt_]  = useState<number | null>(null);

  const businessId = user?.businessId ?? '';

  const refresh = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError(null);

    try {
      const net = await Network.getNetworkStateAsync();
      const online = net.isConnected && net.isInternetReachable;

      if (online) {
        try {
          const [svcRes, pkgRes] = await Promise.all([
            axios.get<Service[]>('/api/services/catalog'),
            axios.get<Package[]>('/api/packages/catalog'),
          ]);

          await Promise.all([
            upsertServices(svcRes.data, businessId),
            upsertPackages(pkgRes.data, businessId),
          ]);

          setServices(svcRes.data);
          setPackages(pkgRes.data);
          setIsOffline(false);

          const ts = await getLastSyncedAt(businessId);
          setLastSyncedAt_(ts);
          return;
        } catch (fetchErr) {
          // Network reported online but fetch failed — fall through to cache
          console.warn('[Catalog] API fetch failed, falling back to cache:', fetchErr);
        }
      }

      // Offline or API error — serve from cache
      const [cachedSvc, cachedPkg, ts] = await Promise.all([
        getCachedServices(businessId),
        getCachedPackages(businessId),
        getLastSyncedAt(businessId),
      ]);

      setServices(cachedSvc);
      setPackages(cachedPkg);
      setIsOffline(true);
      setLastSyncedAt_(ts);

      if (cachedSvc.length === 0 && cachedPkg.length === 0) {
        setError('No cached data available. Connect to the internet to load services.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load services.');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { services, packages, isOffline, loading, error, lastSyncedAt, refresh };
}
