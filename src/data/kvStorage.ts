import { getDB } from '../database/db';

export const kvStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const db = getDB();
      const res = await db.execute('SELECT value FROM sync_metadata WHERE key = ? LIMIT 1;', [key]);
      if (res.rows && res.rows.length > 0) {
        return (res.rows[0] as any).value;
      }
      return null;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = getDB();
      const nowIso = new Date().toISOString();
      await db.execute(
        `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?);`,
        [key, value, nowIso]
      );
    } catch (e) {
      console.error('[KVStorage] Failed to setItem:', e);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const db = getDB();
      await db.execute('DELETE FROM sync_metadata WHERE key = ?;', [key]);
    } catch (e) {
      console.error('[KVStorage] Failed to removeItem:', e);
    }
  },
};

export default kvStorage;
