import { supabase } from '../../data/supabaseClient';
import { api } from '../../data/api';
import syncPush from './syncPush';
import syncPull from './syncPull';
import MemberRepository from '../../data/repositories/MemberRepository';
import SyncExecutionContextValidator, {
  SyncExecutionContext,
  SyncSource,
} from './syncValidator';

export interface ActiveSyncContext {
  promise: Promise<boolean>;
  sessionToken: number;
  userId: string;
  groupId: string;
}

let activeSyncContext: ActiveSyncContext | null = null;

export const getActiveSyncContext = (): ActiveSyncContext | null => activeSyncContext;

const syncListeners = new Set<() => void>();

export const syncEngine = {
  /**
   * Register a lightweight listener to be notified after successful synchronization & SQLite reconciliation.
   * Returns an unsubscribe function for clean cleanup.
   */
  subscribe(listener: () => void): () => void {
    syncListeners.add(listener);
    return () => {
      syncListeners.delete(listener);
    };
  },

  /**
   * Notify subscribers that local SQLite reconciliation has completed.
   */
  notifyListeners(): void {
    syncListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        // console.error('[SyncEngine] Error in sync listener:', err);
      }
    });
  },

  /**
   * Main synchronization entry point.
   * Guarded by session-aware concurrency lock `activeSyncContext`.
   */
  async syncAll(explicitContext?: Partial<SyncExecutionContext>): Promise<boolean> {
    const { useAuthStore, getActiveSessionToken } = require('../auth/authStore');
    const currentSessionToken = explicitContext?.sessionToken ?? getActiveSessionToken();
    const currentAuthState = useAuthStore.getState();
    const targetUserId = explicitContext?.userId || currentAuthState.userId;
    const targetGroupId = explicitContext?.groupId || currentAuthState.member?.groupId;

    // Reuse lock ONLY if matching the exact live session, user, and group
    if (
      activeSyncContext &&
      activeSyncContext.sessionToken === currentSessionToken &&
      activeSyncContext.userId === targetUserId &&
      activeSyncContext.groupId === targetGroupId
    ) {
      return activeSyncContext.promise;
    }

    try {
      let startUserId = explicitContext?.userId || '';
      let startGroupId = explicitContext?.groupId || '';

      // Step 1: Resolve active session and group context if not explicitly provided
      if (!startUserId || !startGroupId) {
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr || !session || !session.user) {
          return false;
        }

        startUserId = session.user.id;

        const localMember = await MemberRepository.getMember(startUserId);
        if (localMember && localMember.groupId) {
          startGroupId = localMember.groupId;
        } else {
          const lookup = await api.getCurrentMember(startUserId);
          if (lookup.status !== 'found' || !lookup.member.groupId) {
            return false;
          }
          startGroupId = lookup.member.groupId;
        }
      }

      const startSessionToken = currentSessionToken;
      const syncSource: SyncSource = explicitContext?.source || 'manual';

      const fullContext: SyncExecutionContext = {
        sessionToken: startSessionToken,
        userId: startUserId,
        groupId: startGroupId,
        source: syncSource,
      };

      if (
        activeSyncContext &&
        activeSyncContext.sessionToken === startSessionToken &&
        activeSyncContext.userId === startUserId &&
        activeSyncContext.groupId === startGroupId
      ) {
        return activeSyncContext.promise;
      }

      // Construct ActiveSyncContext object & assign activeSyncContext BEFORE async execution starts
      const thisContext: ActiveSyncContext = {
        promise: null as any,
        sessionToken: startSessionToken,
        userId: startUserId,
        groupId: startGroupId,
      };

      activeSyncContext = thisContext;

      // Start actual async sync execution
      const executionPromise = (async (): Promise<boolean> => {
        try {
          // Pre-fetch Checkpoint #1 Validation
          const isPreFetchValid = await SyncExecutionContextValidator.validateContext(
            fullContext,
            'pre_fetch'
          );
          if (!isPreFetchValid) {
            return false;
          }

          // Step 2: Push pending local operations to cloud
          await syncPush.processPendingQueue(startUserId);

          // Step 3: Pull remote group, member & presence changes from cloud
          const shouldContinueSync = async (): Promise<boolean> => {
            return await SyncExecutionContextValidator.validateContext(
              fullContext,
              'pre_commit'
            );
          };

          if (!(await shouldContinueSync())) {
            return false;
          }

          const pullSuccess = await syncPull.pullRemoteChanges(
            startGroupId,
            shouldContinueSync
          );

          if (pullSuccess) {
            try {
              const updatedGroupName = await MemberRepository.getGroupName(startGroupId);
              if (updatedGroupName && (await shouldContinueSync())) {
                useAuthStore.setState({ groupName: updatedGroupName });
              }
            } catch {}
            syncEngine.notifyListeners();
            return true;
          }

          return false;
        } catch (error) {
          return false;
        } finally {
          // Safely clear lock only if this exact context still owns it
          if (activeSyncContext === thisContext) {
            activeSyncContext = null;
          }
        }
      })();

      // Attach/store execution promise
      thisContext.promise = executionPromise;

      return executionPromise;
    } catch {
      return false;
    }
  },
};

export default syncEngine;
