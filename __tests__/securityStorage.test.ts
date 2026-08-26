(globalThis as any).__mockKeychainMap = new Map<string, string>();
(globalThis as any).__shouldKeychainWriteFail = false;
(globalThis as any).__shouldKeychainResetFail = false;

jest.mock(
  'react-native-keychain',
  () => ({
    ACCESSIBLE: {
      AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    },
    setGenericPassword: jest.fn().mockImplementation(async (username: string, password: string, options?: any) => {
      if ((globalThis as any).__shouldKeychainWriteFail) {
        throw new Error('Mock Keychain storage write error');
      }
      const service = options?.service || 'default';
      (globalThis as any).__mockKeychainMap.set(service, password);
      return true;
    }),
    getGenericPassword: jest.fn().mockImplementation(async (options?: any) => {
      const service = options?.service || 'default';
      if ((globalThis as any).__mockKeychainMap.has(service)) {
        return { username: 'supabase_session', password: (globalThis as any).__mockKeychainMap.get(service) };
      }
      return false;
    }),
    resetGenericPassword: jest.fn().mockImplementation(async (options?: any) => {
      if ((globalThis as any).__shouldKeychainResetFail) {
        throw new Error('Mock Keychain deletion error');
      }
      const service = options?.service || 'default';
      (globalThis as any).__mockKeychainMap.delete(service);
      return true;
    }),
  }),
  { virtual: true }
);

import { secureStorageAdapter } from '../src/data/supabaseClient';
import { getDB } from '../src/database/db';

jest.mock('../src/database/db');

const TEST_KEY = 'sb-test-auth-token';

const MOCK_VALID_SESSION_A = JSON.stringify({
  access_token: 'mock_jwt_access_AAA',
  refresh_token: 'mock_jwt_refresh_AAA',
  expires_at: 1700000000,
});

const MOCK_VALID_SESSION_B = JSON.stringify({
  access_token: 'mock_jwt_access_BBB',
  refresh_token: 'mock_jwt_refresh_BBB',
  expires_at: 1700000000,
});

describe('OS Secure Storage & Idempotent Session Migration (Priority 2)', () => {
  let sqliteMap: Map<string, string>;

  beforeEach(async () => {
    sqliteMap = new Map<string, string>();
    (globalThis as any).__mockKeychainMap.clear();
    (globalThis as any).__shouldKeychainWriteFail = false;
    (globalThis as any).__shouldKeychainResetFail = false;

    // Mock getDB execute to operate in-memory for Jest tests
    (getDB as jest.Mock).mockReturnValue({
      execute: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT value FROM sync_metadata')) {
          const key = params[0];
          if (sqliteMap.has(key)) {
            return { rows: [{ value: sqliteMap.get(key) }] };
          }
          return { rows: [] };
        }
        if (sql.includes('INSERT OR REPLACE INTO sync_metadata')) {
          const [key, value] = params;
          sqliteMap.set(key, value);
          return { rows: [] };
        }
        if (sql.includes('DELETE FROM sync_metadata')) {
          const key = params[0];
          sqliteMap.delete(key);
          return { rows: [] };
        }
        return { rows: [] };
      }),
    });

    // Clean up before each test
    await secureStorageAdapter.removeItem(TEST_KEY).catch(() => {});
  });

  // 1. Fresh Installation (Keychain empty, SQLite empty)
  it('should return null on fresh installation when both Keychain and SQLite are empty', async () => {
    const val = await secureStorageAdapter.getItem(TEST_KEY);
    expect(val).toBeNull();
  });

  // 2. Normal Session Persistence (setItem -> getItem -> same value returned)
  it('should persist and retrieve session tokens via setItem and getItem', async () => {
    await secureStorageAdapter.setItem(TEST_KEY, MOCK_VALID_SESSION_A);
    const retrieved = await secureStorageAdapter.getItem(TEST_KEY);
    expect(retrieved).toBe(MOCK_VALID_SESSION_A);
    expect((globalThis as any).__mockKeychainMap.has(TEST_KEY)).toBe(true);
  });

  // 3. Migration: Keychain empty, SQLite contains valid session -> Migrated to Keychain & deleted from SQLite after verification
  it('should migrate valid legacy SQLite session to Keychain and remove legacy SQLite record after read-back verification', async () => {
    // Seed legacy SQLite table directly in mock Map
    sqliteMap.set(TEST_KEY, MOCK_VALID_SESSION_A);
    expect(sqliteMap.has(TEST_KEY)).toBe(true);

    // Trigger getItem -> initiates migration
    const val = await secureStorageAdapter.getItem(TEST_KEY);
    expect(val).toBe(MOCK_VALID_SESSION_A);

    // After migration: verify Keychain received value and legacy SQLite row was deleted
    expect((globalThis as any).__mockKeychainMap.get(TEST_KEY)).toBe(MOCK_VALID_SESSION_A);
    expect(sqliteMap.has(TEST_KEY)).toBe(false);
  });

  // 4. Keychain Write Failure During Migration -> Retains SQLite token safely
  it('should retain legacy SQLite session if Keychain write fails during migration', async () => {
    sqliteMap.set(TEST_KEY, MOCK_VALID_SESSION_A);
    (globalThis as any).__shouldKeychainWriteFail = true;

    const val = await secureStorageAdapter.getItem(TEST_KEY);
    expect(val).toBe(MOCK_VALID_SESSION_A);

    // Verify SQLite token was RETAINED to avoid data loss
    expect(sqliteMap.has(TEST_KEY)).toBe(true);
  });

  // 5. Existing Keychain vs Legacy SQLite Conflict -> Keychain session wins
  it('should give precedence to existing Keychain session and not overwrite it with stale SQLite session', async () => {
    // Keychain has Session A, SQLite has Session B
    (globalThis as any).__mockKeychainMap.set(TEST_KEY, MOCK_VALID_SESSION_A);
    sqliteMap.set(TEST_KEY, MOCK_VALID_SESSION_B);

    const val = await secureStorageAdapter.getItem(TEST_KEY);
    
    // Session A must win
    expect(val).toBe(MOCK_VALID_SESSION_A);
    expect((globalThis as any).__mockKeychainMap.get(TEST_KEY)).toBe(MOCK_VALID_SESSION_A);
  });

  // 6. setItem Error Propagation & Zero Plaintext SQLite Token Creation
  it('should REJECT promise and NEVER write plaintext tokens to SQLite when setItem fails', async () => {
    (globalThis as any).__shouldKeychainWriteFail = true;

    await expect(secureStorageAdapter.setItem(TEST_KEY, MOCK_VALID_SESSION_A)).rejects.toThrow(
      'Mock Keychain storage write error'
    );

    // Verify SQLite map has NO plaintext tokens created
    expect(sqliteMap.has(TEST_KEY)).toBe(false);
  });

  // 7. Corrupted Legacy Session Handling
  it('should safely clean up corrupted legacy SQLite session and return null without crashing', async () => {
    // Seed corrupted non-JSON legacy data
    sqliteMap.set(TEST_KEY, 'invalid_corrupted_json_string');

    const val = await secureStorageAdapter.getItem(TEST_KEY);
    expect(val).toBeNull();

    // Verify corrupted SQLite row was cleaned up
    expect(sqliteMap.has(TEST_KEY)).toBe(false);
  });

  // 8. Sign-out Clearing
  it('should completely clear both Keychain and SQLite credentials on removeItem', async () => {
    await secureStorageAdapter.setItem(TEST_KEY, MOCK_VALID_SESSION_A);
    sqliteMap.set(TEST_KEY, MOCK_VALID_SESSION_A);

    await secureStorageAdapter.removeItem(TEST_KEY);

    const val = await secureStorageAdapter.getItem(TEST_KEY);
    expect(val).toBeNull();
    expect(sqliteMap.has(TEST_KEY)).toBe(false);
    expect((globalThis as any).__mockKeychainMap.has(TEST_KEY)).toBe(false);
  });

  // 9. removeItem Error Propagation
  it('should reject promise if Keychain removeItem fails while still attempting legacy SQLite cleanup', async () => {
    sqliteMap.set(TEST_KEY, MOCK_VALID_SESSION_A);
    (globalThis as any).__shouldKeychainResetFail = true;

    await expect(secureStorageAdapter.removeItem(TEST_KEY)).rejects.toThrow('Mock Keychain deletion error');

    // Verify SQLite cleanup was still executed
    expect(sqliteMap.has(TEST_KEY)).toBe(false);
  });
});
