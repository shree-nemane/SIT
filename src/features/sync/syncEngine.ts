import { supabase } from '../../data/supabaseClient';
import { api } from '../../data/api';
import syncPush from './syncPush';
import syncPull from './syncPull';

let activeSyncPromise: Promise<boolean> | null = null;

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
        console.error('[SyncEngine] Error in sync listener:', err);
      }
    });
  },

  /**
   * Main synchronization entry point.
   * Guarded by concurrency lock `activeSyncPromise`. Re-uses active in-flight sync promise if currently running.
   */
  async syncAll(): Promise<boolean> {
    if (activeSyncPromise) {
      console.log('[SyncEngine] Sync cycle already in progress. Awaiting existing sync promise.');
      return activeSyncPromise;
    }

    activeSyncPromise = (async (): Promise<boolean> => {
      console.log('[SyncEngine] Starting synchronization cycle...');
      try {
        // Step 1: Validate active session
        const {
          data: { session },
          error: sessionErr,
        } = await supabase.auth.getSession();

        if (sessionErr || !session || !session.user) {
          console.warn('[SyncEngine] No active session. Halting sync safely without modifying local data.');
          return false;
        }

        const userId = session.user.id;
        const currentMember = await api.getCurrentMember(userId);

        if (!currentMember || !currentMember.groupId) {
          console.log('[SyncEngine] User is not part of a group yet. Halting sync.');
          return false;
        }

        // Step 2: Push pending local operations to cloud
        await syncPush.processPendingQueue(userId);

        // Step 3: Pull remote group, member & presence changes from cloud
        const pullSuccess = await syncPull.pullRemoteChanges(currentMember.groupId);

        if (pullSuccess) {
          console.log('[SyncEngine] Synchronization cycle completed successfully.');
          syncEngine.notifyListeners();
          return true;
        }

        return false;
      } catch (error) {
        console.error('[SyncEngine] Error during syncAll execution:', error);
        return false;
      } finally {
        activeSyncPromise = null;
      }
    })();

    return activeSyncPromise;
  },
};

export default syncEngine;
