import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';

/**
 * Dependency-free helper to check OS notification permissions on Android (SDK 33+) & iOS.
 */
export async function checkOSNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const hasPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (!hasPermission) return false;
    }
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}
