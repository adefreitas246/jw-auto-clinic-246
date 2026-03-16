/**
 * utils/db.ts
 *
 * Generic SQLite key-value cache + local mutation tables.
 * Uses the same `wash_hub.db` file as the catalog (db/catalogDb.ts)
 * and inventory cache (hooks/useInventoryCache.ts).
 *
 * Tables added:
 *   cache         — generic JSON key-value store with TTL
 *   bookings_local — offline booking drafts
 *   jobs_local     — offline job status snapshots
 */
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'wash_hub.db';

let _db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync(`
    CREATE TABLE IF NOT EXISTS cache (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings_local (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      synced     INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs_local (
      id         TEXT PRIMARY KEY,
      data       TEXT NOT NULL,
      status     TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return _db;
}

/** Store any JSON-serialisable value under a key. */
export async function cacheSet(key: string, value: unknown): Promise<void> {
  try {
    const db   = await getDb();
    const json = JSON.stringify(value);
    await db.runAsync(
      'INSERT OR REPLACE INTO cache (key, value, updated_at) VALUES (?, ?, ?)',
      [key, json, Date.now()],
    );
  } catch (err) {
    console.warn('[db] cacheSet error:', err);
  }
}

/**
 * Read a value from the cache.
 * Returns null when the key is missing or older than `maxAgeMs` (default 5 min).
 */
export async function cacheGet<T>(
  key: string,
  maxAgeMs = 5 * 60 * 1000,
): Promise<T | null> {
  try {
    const db  = await getDb();
    const row = await db.getFirstAsync<{ value: string; updated_at: number }>(
      'SELECT value, updated_at FROM cache WHERE key = ?',
      [key],
    );
    if (!row) return null;
    if (Date.now() - row.updated_at > maxAgeMs) return null;
    return JSON.parse(row.value) as T;
  } catch (err) {
    console.warn('[db] cacheGet error:', err);
    return null;
  }
}

/** Remove a single key from the cache. */
export async function cacheClear(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM cache WHERE key = ?', [key]);
  } catch (err) {
    console.warn('[db] cacheClear error:', err);
  }
}

/** Remove all cache entries (e.g. after logout). */
export async function cacheClearAll(): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM cache');
  } catch (err) {
    console.warn('[db] cacheClearAll error:', err);
  }
}

/** Initialise the database (call once on app start). */
export async function initDatabase(): Promise<void> {
  await getDb();
}

export { getDb };
