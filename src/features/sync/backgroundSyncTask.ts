import syncEngine from './syncEngine';
import bootstrapBackgroundRuntime from './backgroundRuntime';
import { SyncSource } from './syncValidator';

/**
 * Headless JS Background Task for synchronization.
 * Bootstraps durable background runtime context before invoking syncEngine.
 */

export interface BackgroundSyncTaskData {
  source?: SyncSource | string;
  reason?: string;
  [key: string]: any;
}

export const backgroundSyncTask = async (taskData?: BackgroundSyncTaskData): Promise<void> => {
  const source: SyncSource = (taskData?.source as SyncSource) || 'background_fcm';

  try {
    // 1. Perform durable local-first runtime bootstrap
    const context = await bootstrapBackgroundRuntime(source);

    if (!context) {
      if (__DEV__) {
        // console.log('[BackgroundSyncTask] Background runtime bootstrap aborted (no valid session/member)');
      }
      return;
    }

    // 2. Invoke the central reconciliation engine with explicit background context
    await syncEngine.syncAll(context);
  } catch (error: any) {
    if (__DEV__) {
      // console.log('[BackgroundSyncTask] Background sync error caught safely:', error?.message || error);
    }
  }

  return Promise.resolve();
};

export default backgroundSyncTask;
