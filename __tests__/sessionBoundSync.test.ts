import { NativeModules, Platform } from 'react-native';

// Set NativeModules.WidgetBridge and Platform.OS BEFORE widgetSnapshot is imported
Platform.OS = 'android';
NativeModules.WidgetBridge = {
  updateWidgetSnapshot: jest.fn().mockResolvedValue(true),
  getLocalMediaFile: jest.fn().mockResolvedValue(null),
};

// Mock op-sqlite DB
const mockExecuteBatch = jest.fn().mockResolvedValue({ rowsAffected: 1 });
const mockExecute = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('../src/database/db', () => ({
  getDB: () => ({
    executeBatch: mockExecuteBatch,
    execute: mockExecute,
  }),
}));

// Mock Supabase Client
jest.mock('../src/data/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user_1' } } },
        error: null,
      }),
    },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'groups') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'grp_1', name: 'Test Group', owner_id: 'user_1', created_at: new Date().toISOString() },
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
              data: [{ id: 'user_1', group_id: 'grp_1', display_name: 'User One', profile_image_id: null }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'presences') {
        return {
          select: () => ({
            in: async () => ({
              data: [],
              error: null,
            }),
          }),
        };
      }
      if (table === 'images') {
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

import widgetSnapshotService from '../src/features/widget/widgetSnapshot';
import syncPull from '../src/features/sync/syncPull';

describe('Session-Bound Sync & Widget Reliability Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('A. Widget Guard on Stale Session', () => {
    it('should skip widget update if shouldContinueSync becomes false immediately after SQLite executeBatch', async () => {
      let isSessionValid = true;

      const shouldContinueSync = () => {
        return isSessionValid;
      };

      mockExecuteBatch.mockImplementationOnce(async () => {
        isSessionValid = false;
        return { rowsAffected: 1 };
      });

      const res = await syncPull.pullRemoteChanges('grp_1', shouldContinueSync);

      expect(res).toBe(false);
      expect(mockExecuteBatch).toHaveBeenCalled();
      expect(NativeModules.WidgetBridge.updateWidgetSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('B. Sign-Out Widget Cleanup', () => {
    it('should clear widget snapshot and notify native Android widget on clearWidgetSnapshot', async () => {
      const success = await widgetSnapshotService.clearWidgetSnapshot();

      expect(success).toBe(true);
      expect(NativeModules.WidgetBridge.updateWidgetSnapshot).toHaveBeenCalledWith(
        expect.stringContaining('"members":[]')
      );
    });
  });

  describe('C. ActiveSyncContext Lock Lifecycle & Regression Test', () => {
    it('should clear activeSyncContext upon completion and execute a new sync instead of reusing a stale lock', async () => {
      const { syncEngine, getActiveSyncContext } = require('../src/features/sync/syncEngine');
      const { api } = require('../src/data/api');
      const { useAuthStore } = require('../src/features/auth/authStore');

      // Set valid Zustand auth state matching user_1 & grp_1
      useAuthStore.setState({
        authStatus: 'signed_in',
        membershipStatus: 'member',
        userId: 'user_1',
        member: {
          id: 'user_1',
          groupId: 'grp_1',
          displayName: 'User One',
          profileImageId: null,
          joinedAt: new Date().toISOString(),
        },
      });

      api.getCurrentMember = jest.fn().mockResolvedValue({
        status: 'found',
        member: { id: 'user_1', groupId: 'grp_1' },
      });

      // 1. First sync execution
      const res1 = await syncEngine.syncAll();
      expect(res1).toBe(true);

      // Verify activeSyncContext is cleared cleanly after completion
      expect(getActiveSyncContext()).toBeNull();

      // 2. Second sync execution immediately after
      const res2 = await syncEngine.syncAll();
      expect(res2).toBe(true);

      // Verify second sync also completed cleanly and cleared lock
      expect(getActiveSyncContext()).toBeNull();
      expect(api.getCurrentMember).toHaveBeenCalledTimes(2);
    });
  });
});
