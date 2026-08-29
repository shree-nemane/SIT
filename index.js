/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import { validateSITPayload } from './src/features/notifications/pushService';
import notificationService from './src/features/notifications/notificationService';
import backgroundSyncTask from './src/features/sync/backgroundSyncTask';

// Background messaging handler registered outside component rendering lifecycle
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  const payload = validateSITPayload(remoteMessage?.data);
  if (__DEV__) {
    // console.log('[PushService] Background FCM message received:', payload || remoteMessage?.data);
  }

  if (payload) {
    // Execute synchronization and notification presentation in independent, decoupled branches
    await Promise.allSettled([
      // Branch 1: Direct Headless Background Sync (SQLite reconciliation + Widget Snapshot update)
      backgroundSyncTask({
        source: 'background_fcm',
        reason: payload.reason,
      }),

      // Branch 2: Immediate Local Notification Presentation (respects Quiet Mode & deduplication)
      notificationService.showPresenceUpdateNotification({
        presenceId: payload.presenceId,
        actorName: payload.actorName,
        actorId: payload.actorId,
        groupId: payload.groupId,
        reason: payload.reason,
        description: payload.description,
      }),
    ]);
  }
});

// Register Headless JS task for background execution
AppRegistry.registerHeadlessTask('BackgroundSyncTask', () => backgroundSyncTask);

AppRegistry.registerComponent(appName, () => App);
