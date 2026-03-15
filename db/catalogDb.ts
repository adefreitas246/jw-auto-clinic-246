/**
 * db/catalogDb.ts
 *
 * SQLite schema and helpers for offline service/package caching.
 * Database file: wash_hub.db
 *
 * Schema
 * ──────
 *   sync_meta          – one row per (key, business_id) — tracks last sync timestamp
 *   services           – mirrors the Service API shape
 *   packages           – mirrors the Package API shape
 *   package_services   – join table: package ↔ service ids
 */
import * as SQLite from 'expo-sqlite';

import { Package, Service } from '@/types/catalog';

const DB_NAME = 'wash_hub.db';

// ─── Open / init ─────────────────────────────────────────────────────────────

let _db: SQLite.SQLiteDatabase | null = null;

export async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await initSchema(_db);
  return _db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sync_meta (
      key         TEXT NOT NULL,
      business_id TEXT NOT NULL,
      synced_at   INTEGER NOT NULL,
      PRIMARY KEY (key, business_id)
    );

    CREATE TABLE IF NOT EXISTS services (
      id          TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name        TEXT NOT NULL,
      price       REAL NOT NULL,
      duration    INTEGER NOT NULL DEFAULT 30,
      category    TEXT NOT NULL DEFAULT 'General',
      description TEXT NOT NULL DEFAULT '',
      active      INTEGER NOT NULL DEFAULT 1,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS packages (
      id          TEXT PRIMARY KEY,
      business_id TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price       REAL,
      active      INTEGER NOT NULL DEFAULT 1,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS package_services (
      package_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      PRIMARY KEY (package_id, service_id)
    );

    CREATE INDEX IF NOT EXISTS idx_services_business
      ON services (business_id, active);

    CREATE INDEX IF NOT EXISTS idx_packages_business
      ON packages (business_id, active);
  `);
}

// ─── Sync meta ────────────────────────────────────────────────────────────────

export async function getLastSyncedAt(
  businessId: string,
  key = 'catalog'
): Promise<number | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<{ synced_at: number }>(
    'SELECT synced_at FROM sync_meta WHERE key = ? AND business_id = ?',
    [key, businessId]
  );
  return row?.synced_at ?? null;
}

async function setLastSyncedAt(
  businessId: string,
  key = 'catalog'
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `INSERT INTO sync_meta (key, business_id, synced_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key, business_id) DO UPDATE SET synced_at = excluded.synced_at`,
    [key, businessId, Date.now()]
  );
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function upsertServices(
  services: Service[],
  businessId: string
): Promise<void> {
  if (!services.length) return;
  const db = await openDb();

  await db.withTransactionAsync(async () => {
    for (const s of services) {
      await db.runAsync(
        `INSERT INTO services
           (id, business_id, name, price, duration, category, description, active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name        = excluded.name,
           price       = excluded.price,
           duration    = excluded.duration,
           category    = excluded.category,
           description = excluded.description,
           active      = excluded.active,
           updated_at  = excluded.updated_at`,
        [
          s._id,
          businessId,
          s.name,
          s.price,
          s.duration,
          s.category,
          s.description,
          s.active ? 1 : 0,
          s.updatedAt,
        ]
      );
    }
    await setLastSyncedAt(businessId);
  });
}

export async function getCachedServices(businessId: string): Promise<Service[]> {
  const db = await openDb();
  const rows = await db.getAllAsync<{
    id: string;
    business_id: string;
    name: string;
    price: number;
    duration: number;
    category: string;
    description: string;
    active: number;
    updated_at: string;
  }>(
    `SELECT * FROM services
     WHERE business_id = ? AND active = 1
     ORDER BY category, name`,
    [businessId]
  );
  return rows.map(r => ({
    _id:         r.id,
    businessId:  r.business_id,
    name:        r.name,
    price:       r.price,
    duration:    r.duration,
    category:    r.category,
    description: r.description,
    active:      r.active === 1,
    updatedAt:   r.updated_at,
  }));
}

// ─── Packages ─────────────────────────────────────────────────────────────────

export async function upsertPackages(
  packages: Package[],
  businessId: string
): Promise<void> {
  if (!packages.length) return;
  const db = await openDb();

  await db.withTransactionAsync(async () => {
    for (const pkg of packages) {
      await db.runAsync(
        `INSERT INTO packages
           (id, business_id, name, description, price, active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name        = excluded.name,
           description = excluded.description,
           price       = excluded.price,
           active      = excluded.active,
           updated_at  = excluded.updated_at`,
        [
          pkg._id,
          businessId,
          pkg.name,
          pkg.description,
          pkg.price,
          pkg.active ? 1 : 0,
          pkg.updatedAt,
        ]
      );

      // Refresh join rows for this package
      await db.runAsync(
        'DELETE FROM package_services WHERE package_id = ?',
        [pkg._id]
      );
      for (const svc of pkg.serviceIds) {
        await db.runAsync(
          `INSERT OR IGNORE INTO package_services (package_id, service_id)
           VALUES (?, ?)`,
          [pkg._id, svc._id]
        );
      }
    }
  });
}

export async function getCachedPackages(businessId: string): Promise<Package[]> {
  const db = await openDb();

  const pkgRows = await db.getAllAsync<{
    id: string;
    business_id: string;
    name: string;
    description: string;
    price: number | null;
    active: number;
    updated_at: string;
  }>(
    `SELECT * FROM packages
     WHERE business_id = ? AND active = 1
     ORDER BY name`,
    [businessId]
  );

  // For each package, fetch its services from the join table
  const packages: Package[] = [];
  for (const p of pkgRows) {
    const svcRows = await db.getAllAsync<{
      id: string;
      name: string;
      price: number;
      duration: number;
      category: string;
    }>(
      `SELECT s.id, s.name, s.price, s.duration, s.category
       FROM package_services ps
       JOIN services s ON s.id = ps.service_id
       WHERE ps.package_id = ?`,
      [p.id]
    );

    packages.push({
      _id:         p.id,
      businessId:  p.business_id,
      name:        p.name,
      description: p.description,
      price:       p.price,
      active:      p.active === 1,
      updatedAt:   p.updated_at,
      serviceIds:  svcRows.map(s => ({
        _id:      s.id,
        name:     s.name,
        price:    s.price,
        duration: s.duration,
        category: s.category,
      })),
    });
  }

  return packages;
}
