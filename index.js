/**
 * @format
 */

import { AppRegistry, NativeModules } from 'react-native';
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
    console.log('[PushService] Background FCM message received:', payload || remoteMessage?.data);
  }

  if (payload) {
    // 1. Trigger existing background sync trigger (WorkManager -> Headless JS -> syncEngine.syncAll() -> SQLite + Widget)
    try {
      if (NativeModules.WidgetBridge && typeof NativeModules.WidgetBridge.triggerBackgroundSync === 'function') {
        await NativeModules.WidgetBridge.triggerBackgroundSync();
        if (__DEV__) {
          console.log('[PushService] Enqueued WorkManager one-time background sync from background FCM message');
        }
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[PushService] Failed to trigger WorkManager from background FCM message:', err);
      }
    }

    // 2. Display local visible notification banner safely (failure isolated from background sync)
    try {
      await notificationService.showPresenceUpdateNotification({
        presenceId: payload.presenceId,
        actorName: payload.actorName,
        actorId: payload.actorId,
        groupId: payload.groupId,
        reason: payload.reason,
        description: payload.description,
      });
    } catch (notifErr) {
      if (__DEV__) {
        console.log('[PushService] Failed to display local background notification:', notifErr);
      }
    }
  }
});

// Register Headless JS task for WorkManager background execution
AppRegistry.registerHeadlessTask('BackgroundSyncTask', () => backgroundSyncTask);

AppRegistry.registerComponent(appName, () => App);
