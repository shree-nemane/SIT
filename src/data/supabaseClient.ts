import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
import { getDB } from '../database/db';

/**
 * Custom SQLite Auth Storage Adapter for Supabase
 * Persists Auth Session (access_token, refresh_token) into local SQLite sync_metadata table.
 */
const sqliteStorage = {
  getItem: async (key: string): Promise<string | null> => {
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
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      const db = getDB();
      const now = new Date().toISOString();
      await db.execute(
        'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?);',
        [key, value, now]
      );
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      const db = getDB();
      await db.execute('DELETE FROM sync_metadata WHERE key = ?;', [key]);
    } catch {}
  },
};

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  console.error('[SupabaseClient Error] Missing valid SUPABASE_URL or SUPABASE_ANON_KEY configuration.');
}

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: sqliteStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
