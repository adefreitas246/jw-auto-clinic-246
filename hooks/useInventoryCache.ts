// hooks/useInventoryCache.ts
// SQLite-backed offline cache for inventory items.
//
// Usage:
//   const cache = useInventoryCache();
//   await cache.saveAll(apiItems);       // after successful API fetch
//   const items = await cache.readAll(); // when offline
//   await cache.patchStock(id, newVal);  // after a quick-adjust succeeds
//   await cache.remove(id);             // after delete succeeds
import * as SQLite from 'expo-sqlite';
import { useRef, useEffect, useCallback } from 'react';

export interface CachedInventoryItem {
  _id:               string;
  name:              string;
  category:          string;
  currentStock:      number;
  unit:              string;
  lowStockThreshold: number;
  notes:             string;
  businessId:        string;
  updatedAt:         string;
  syncedAt:          string;
}

const DB_NAME = 'washhub.db';

// Module-level singleton so the DB is opened only once across re-renders
let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      // WAL mode for better concurrent read performance
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS inventory_cache (
          _id               TEXT PRIMARY KEY,
          name              TEXT NOT NULL DEFAULT '',
          category          TEXT NOT NULL DEFAULT 'Other',
          currentStock      REAL NOT NULL DEFAULT 0,
          unit              TEXT NOT NULL DEFAULT 'units',
          lowStockThreshold REAL NOT NULL DEFAULT 10,
          notes             TEXT NOT NULL DEFAULT '',
          businessId        TEXT NOT NULL DEFAULT '',
          updatedAt         TEXT NOT NULL DEFAULT '',
          syncedAt          TEXT NOT NULL DEFAULT ''
        );
      `);
      return db;
    })();
  }
  return _dbPromise;
}

export function useInventoryCache() {
  // Trigger DB init once on mount
  useEffect(() => {
    getDb().catch(err => console.warn('[InventoryCache] init error:', err));
  }, []);

  /** Upsert all items from the API into the local cache. */
  const saveAll = useCallback(async (items: any[]): Promise<void> => {
    try {
      const db  = await getDb();
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        for (const item of items) {
          await db.runAsync(
            `INSERT OR REPLACE INTO inventory_cache
               (_id, name, category, currentStock, unit, lowStockThreshold, notes, businessId, updatedAt, syncedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              String(item._id),
              String(item.name ?? ''),
              String(item.category ?? 'Other'),
              Number(item.currentStock ?? 0),
              String(item.unit ?? 'units'),
              Number(item.lowStockThreshold ?? 10),
              String(item.notes ?? ''),
              String(item.businessId ?? ''),
              String(item.updatedAt ?? ''),
              now,
            ]
          );
        }
      });
    } catch (err) {
      console.warn('[InventoryCache] saveAll error:', err);
    }
  }, []);

  /** Return all cached items sorted by category then name. */
  const readAll = useCallback(async (): Promise<CachedInventoryItem[]> => {
    try {
      const db = await getDb();
      return await db.getAllAsync<CachedInventoryItem>(
        'SELECT * FROM inventory_cache ORDER BY category ASC, name ASC'
      );
    } catch (err) {
      console.warn('[InventoryCache] readAll error:', err);
      return [];
    }
  }, []);

  /** Update only the currentStock for a single item (after a quick-adjust). */
  const patchStock = useCallback(async (id: string, currentStock: number): Promise<void> => {
    try {
      const db  = await getDb();
      const now = new Date().toISOString();
      await db.runAsync(
        'UPDATE inventory_cache SET currentStock = ?, syncedAt = ? WHERE _id = ?',
        [currentStock, now, id]
      );
    } catch (err) {
      console.warn('[InventoryCache] patchStock error:', err);
    }
  }, []);

  /** Remove a deleted item from the cache. */
  const remove = useCallback(async (id: string): Promise<void> => {
    try {
      const db = await getDb();
      await db.runAsync('DELETE FROM inventory_cache WHERE _id = ?', [id]);
    } catch (err) {
      console.warn('[InventoryCache] remove error:', err);
    }
  }, []);

  /** Full upsert for a single item (after create/edit). */
  const upsertOne = useCallback(async (item: any): Promise<void> => {
    try {
      const db  = await getDb();
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR REPLACE INTO inventory_cache
           (_id, name, category, currentStock, unit, lowStockThreshold, notes, businessId, updatedAt, syncedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(item._id),
          String(item.name ?? ''),
          String(item.category ?? 'Other'),
          Number(item.currentStock ?? 0),
          String(item.unit ?? 'units'),
          Number(item.lowStockThreshold ?? 10),
          String(item.notes ?? ''),
          String(item.businessId ?? ''),
          String(item.updatedAt ?? now),
          now,
        ]
      );
    } catch (err) {
      console.warn('[InventoryCache] upsertOne error:', err);
    }
  }, []);

  return { saveAll, readAll, patchStock, remove, upsertOne };
}
