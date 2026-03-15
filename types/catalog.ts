// types/catalog.ts
export interface Service {
  _id: string;
  businessId: string;
  name: string;
  price: number;
  duration: number;   // minutes
  category: string;
  description: string;
  active: boolean;
  updatedAt: string;
}

export interface ServiceRef {
  _id: string;
  name: string;
  price: number;
  duration: number;
  category: string;
}

export interface Package {
  _id: string;
  businessId: string;
  name: string;
  description: string;
  /** Explicit override price. null → sum of included service prices. */
  price: number | null;
  serviceIds: ServiceRef[];
  active: boolean;
  updatedAt: string;
}

/** Resolved price for a package (override or sum) */
export function packagePrice(pkg: Package): number {
  if (pkg.price != null) return pkg.price;
  return pkg.serviceIds.reduce((acc, s) => acc + s.price, 0);
}

/** Total duration in minutes for a package */
export function packageDuration(pkg: Package): number {
  return pkg.serviceIds.reduce((acc, s) => acc + s.duration, 0);
}

export interface CatalogState {
  services: Service[];
  packages: Package[];
  isOffline: boolean;
  loading: boolean;
  error: string | null;
  lastSyncedAt: number | null;  // unix ms
  refresh: () => Promise<void>;
}
