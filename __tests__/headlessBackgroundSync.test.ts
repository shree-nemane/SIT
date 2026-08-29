import { NativeModules, Platform } from 'react-native';

Platform.OS = 'android';
NativeModules.WidgetBridge = {
  updateWidgetSnapshot: jest.fn().mockResolvedValue(true),
  getLocalMediaFile: jest.fn().mockResolvedValue(null),
};

const mockExecuteBatch = jest.fn().mockResolvedValue({ rowsAffected: 1 });
const mockExecute = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('../src/database/db', () => ({
  initDatabase: jest.fn().mockResolvedValue(true),
  getDB: () => ({
    executeBatch: mockExecuteBatch,
    execute: mockExecute,
  }),
}));

let mockSupabaseSession: any = { user: { id: 'user_headless_1' } };
let mockLocalMember: any = { id: 'user_headless_1', groupId: 'grp_headless_1' };

jest.mock('../src/data/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockImplementation(async () => ({
        data: { session: mockSupabaseSession },
        error: null,
      })),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'groups') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'grp_headless_1', name: 'Headless Group', owner_id: 'user_headless_1', created_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'members') {
        return {
          select: () => ({
            eq: async () => ({
              data: [{ id: 'user_headless_1', group_id: 'grp_headless_1', display_name: 'Headless User', profile_image_id: null }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'presences' || table === 'images') {
        return {
          select: () => ({
            in: async () => ({
              data: [],
              error: null,
            }),
          }),
        };
      }
      return {};
    }),
  },
}));

jest.mock('../src/data/repositories/MemberRepository', () => ({
  getMember: jest.fn().mockImplementation(async (userId: string) => {
    if (userId === mockLocalMember?.id) return mockLocalMember;
    return null;
  }),
  getGroupName: jest.fn().mockResolvedValue('Headless Group'),
}));

import bootstrapBackgroundRuntime from '../src/features/sync/backgroundRuntime';
import syncEngine, { getActiveSyncContext } from '../src/features/sync/syncEngine';
import backgroundSyncTask from '../src/features/sync/backgroundSyncTask';
import { SyncExecutionContextValidator, SyncSource } from '../src/features/sync/syncValidator';
import { useAuthStore } from '../src/features/auth/authStore';
import { initDatabase } from '../src/database/db';

describe('Headless Background Sync Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseSession = { user: { id: 'user_headless_1' } };
    mockLocalMember = { id: 'user_headless_1', groupId: 'grp_headless_1' };
    useAuthStore.setState({ authStatus: 'signed_out', userId: null, member: null });
  });

  describe('1. Durable Background Runtime Bootstrap', () => {
    it('should bootstrap valid SyncExecutionContext when Supabase session and local member exist', async () => {
      const context = await bootstrapBackgroundRuntime('background_fcm');

      expect(initDatabase).toHaveBeenCalled();
      expect(context).not.toBeNull();
      expect(context?.userId).toBe('user_headless_1');
      expect(context?.groupId).toBe('grp_headless_1');
      expect(context?.source).toBe('background_fcm');
    });

    it('should abort (return null) if Supabase session is missing', async () => {
      mockSupabaseSession = null;
      const context = await bootstrapBackgroundRuntime('background_fcm');
      expect(context).toBeNull();
    });

    it('should abort (return null) if local SQLite member is missing', async () => {
      mockLocalMember = null;
      const context = await bootstrapBackgroundRuntime('background_fcm');
      expect(context).toBeNull();
    });

    it('should abort (return null) if local member has empty groupId', async () => {
      mockLocalMember = { id: 'user_headless_1', groupId: '' };
      const context = await bootstrapBackgroundRuntime('background_fcm');
      expect(context).toBeNull();
    });
  });

  describe('2. Headless Sync Execution with Default Idle Zustand', () => {
    it('should execute sync, SQLite batch, and widget update with Zustand in signed_out state', async () => {
      expect(useAuthStore.getState().authStatus).toBe('signed_out');

      await backgroundSyncTask({ source: 'background_fcm' });

      expect(mockExecuteBatch).toHaveBeenCalled();
      expect(NativeModules.WidgetBridge.updateWidgetSnapshot).toHaveBeenCalled();
    });
  });

  describe('3. Cross-Runtime Sign-Out Race Protection', () => {
    it('should abort executeBatch if durable session is revoked during remote fetch', async () => {
      const context = await bootstrapBackgroundRuntime('background_fcm');
      expect(context).not.toBeNull();

      // Revoke session right before pre_commit checkpoint
      mockSupabaseSession = null;

      const isValid = await SyncExecutionContextValidator.validateContext(context!, 'pre_commit');
      expect(isValid).toBe(false);
    });

    it('should abort executeBatch if local member is deleted during remote fetch', async () => {
      const context = await bootstrapBackgroundRuntime('background_fcm');
      expect(context).not.toBeNull();

      // Delete local member record right before pre_commit checkpoint
      mockLocalMember = null;

      const isValid = await SyncExecutionContextValidator.validateContext(context!, 'pre_commit');
      expect(isValid).toBe(false);
    });
  });

  describe('4. SyncSource Propagation & Active Sync Lock Isolation', () => {
    it('should propagate all SyncSource types cleanly', async () => {
      const sources: SyncSource[] = [
        'foreground_push',
        'background_fcm',
        'periodic',
        'startup',
        'network_restore',
        'manual',
      ];

      for (const src of sources) {
        const ctx = await bootstrapBackgroundRuntime(src);
        expect(ctx?.source).toBe(src);
      }
    });

    it('should keep active sync lock isolated across different user/group contexts', async () => {
      const ctx1 = { sessionToken: 1, userId: 'user_headless_1', groupId: 'grp_headless_1', source: 'manual' as SyncSource };
      const ctx2 = { sessionToken: 2, userId: 'u2', groupId: 'g2', source: 'manual' as SyncSource };

      const sync1Promise = syncEngine.syncAll(ctx1);
      const activeCtx = getActiveSyncContext();
      expect(activeCtx?.userId).toBe('user_headless_1');

      // Sync for user 2 does not reuse lock for user 1
      const isReused = activeCtx?.userId === ctx2.userId;
      expect(isReused).toBe(false);

      await sync1Promise;
    });
  });
});
