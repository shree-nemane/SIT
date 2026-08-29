import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';
import { getDB } from '../database/db';

import { Platform } from 'react-native';

let Keychain: any = null;
try {
  Keychain = require('react-native-keychain');
} catch {
  Keychain = null;
}

const getKeychainOptions = (key: string) => {
  const opts: any = { service: key };
  if (Platform.OS === 'ios' && Keychain?.ACCESSIBLE?.AFTER_FIRST_UNLOCK) {
    opts.accessible = Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK;
  }
  return opts;
};

/**
 * OS-Backed Secure Storage Adapter for Supabase with Idempotent Legacy SQLite Session Migration.
 * Saves credentials into iOS Keychain / Android EncryptedSharedPreferences (ACCESSIBLE.AFTER_FIRST_UNLOCK).
 */
export const secureStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    // 1. Try reading from OS Secure Storage (Keychain)
    try {
      if (Keychain && typeof Keychain.getGenericPassword === 'function') {
        const credentials = await Keychain.getGenericPassword({ service: key });
        if (credentials && credentials.password) {
          try {
            const parsed = JSON.parse(credentials.password);
            if (parsed && (parsed.access_token || parsed.currentSession || parsed.expires_at)) {
              return credentials.password;
            }
          } catch {
            // Corrupted secure entry — clean up Keychain safely
            await Keychain.resetGenericPassword({ service: key }).catch(() => {});
          }
        }
      }
    } catch (kErr: any) {
      if (!kErr?.message?.includes('getGenericPasswordForOptions') && !kErr?.message?.includes('RNKeychainManager')) {
        // console.warn('[SecureStorage] Keychain getItem read warning:', kErr?.message || kErr);
      }
    }

    // 2. Not in Keychain -> Check legacy SQLite sync_metadata table
    try {
      const db = getDB();
      const res = await db.execute('SELECT value FROM sync_metadata WHERE key = ? LIMIT 1;', [key]);
      if (res.rows && res.rows.length > 0) {
        const legacyValue = (res.rows[0] as any).value;
        if (!legacyValue) return null;

        // Validate JSON payload
        try {
          const parsed = JSON.parse(legacyValue);
          if (!parsed || (!parsed.access_token && !parsed.currentSession && !parsed.expires_at)) {
            // Corrupted legacy session data — delete from SQLite
            await db.execute('DELETE FROM sync_metadata WHERE key = ?;', [key]).catch(() => {});
            return null;
          }
        } catch {
          // Invalid JSON format — delete corrupted legacy record
          await db.execute('DELETE FROM sync_metadata WHERE key = ?;', [key]).catch(() => {});
          return null;
        }

        // Migration step: Write valid legacy session to Keychain with ACCESSIBLE.AFTER_FIRST_UNLOCK
        try {
          if (Keychain && typeof Keychain.setGenericPassword === 'function') {
            await Keychain.setGenericPassword('supabase_session', legacyValue, getKeychainOptions(key));

            // Read-back verification
            const verify = await Keychain.getGenericPassword({ service: key });
            if (verify && verify.password === legacyValue) {
              // POSITIVE VERIFICATION CONFIRMED -> Delete legacy SQLite token
              await db.execute('DELETE FROM sync_metadata WHERE key = ?;', [key]).catch(() => {});
              // console.log('[SecureStorage] Successfully migrated legacy session to OS Keychain and deleted SQLite record.');
            }
          }
        } catch (migErr) {
          // console.warn('[SecureStorage] Migration write warning (retaining SQLite token):', migErr);
        }

        // Always return legacy value so session restores even if Keychain migration fails
        return legacyValue;
      }
    } catch (sqlErr) {
      // console.warn('[SecureStorage] SQLite legacy check warning:', sqlErr);
    }

    return null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (!Keychain || typeof Keychain.setGenericPassword !== 'function') {
      const err = new Error('[SecureStorage] OS Keychain module unavailable. Cannot store session securely.');
      // console.error(err.message);
      throw err;
    }

    try {
      await Keychain.setGenericPassword('supabase_session', value, getKeychainOptions(key));
    } catch (kErr) {
      // console.error('[SecureStorage] Failed to store auth session in OS Keychain:', kErr);
      throw kErr;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    let keychainErr: any = null;

    // 1. Delete Keychain credentials
    try {
      if (Keychain && typeof Keychain.resetGenericPassword === 'function') {
        await Keychain.resetGenericPassword({ service: key });
      }
    } catch (kErr) {
      // console.error('[SecureStorage] Keychain removeItem error:', kErr);
      keychainErr = kErr;
    }

    // 2. Delete any remaining legacy SQLite entry
    try {
      const db = getDB();
      await db.execute('DELETE FROM sync_metadata WHERE key = ?;', [key]);
    } catch (sqlErr) {
      // console.warn('[SecureStorage] SQLite removeItem error:', sqlErr);
    }

    // Re-throw if Keychain deletion failed
    if (keychainErr) {
      throw keychainErr;
    }
  },
};

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  // console.error('[SupabaseClient Error] Missing valid SUPABASE_URL or SUPABASE_ANON_KEY configuration.');
}

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
