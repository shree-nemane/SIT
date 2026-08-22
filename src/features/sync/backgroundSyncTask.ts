import syncEngine from './syncEngine';

/**
 * Headless JS Background Task for WorkManager background synchronization.
 * Invokes the central syncEngine.syncAll() reconciliation engine in the background
 * even when the application UI is inactive or terminated.
 */

export interface BackgroundSyncTaskData {
  source?: string;
  reason?: string;
  [key: string]: any;
}

export const backgroundSyncTask = async (taskData?: BackgroundSyncTaskData): Promise<void> => {
  const source = taskData?.source || 'workmanager';
  const reason = taskData?.reason || 'periodic_sync';

  if (__DEV__) {
    console.log('[BackgroundSyncTask] Background sync started', {
      source,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Invoke the single, centralized reconciliation engine.
    // SyncEngine internal activeSyncPromise concurrency lock prevents concurrent duplicate syncs.
    const success = await syncEngine.syncAll();

    if (__DEV__) {
      console.log('[BackgroundSyncTask] Background sync completed', {
        success,
        source,
        reason,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    if (__DEV__) {
      console.log('[BackgroundSyncTask] Background sync error caught safely:', error?.message || error);
    }
  }

  return Promise.resolve();
};

export default backgroundSyncTask;
