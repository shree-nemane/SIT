import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { api } from '../../data/api';
import syncEngine from '../sync/syncEngine';
import notificationService from './notificationService';
import { SITNotificationPayload } from './notificationTypes';

export type SITDataPayload = SITNotificationPayload;

/**
 * Validate and format expected SIT FCM data payload.
 * Extracts clean properties without exposing sensitive message fields.
 */
export const validateSITPayload = (data?: Record<string, any>): SITDataPayload | null => {
  if (!data || typeof data !== 'object') return null;
  const {
    version,
    type,
    groupId,
    presenceId,
    presence_id,
    reason,
    actorName,
    actor_name,
    displayName,
    display_name,
    actorId,
    memberId,
    actor_id,
    member_id,
    description,
    status,
    caption,
  } = data;
  if (!type) return null;

  const resolvedActorName = actorName || actor_name || displayName || display_name;
  const resolvedActorId = actorId || memberId || actor_id || member_id;
  const resolvedDescription = description || status || caption;
  const resolvedPresenceId = presenceId || presence_id;

  return {
    version: version ? String(version) : '1',
    type: String(type),
    groupId: groupId ? String(groupId) : '',
    presenceId: resolvedPresenceId ? String(resolvedPresenceId) : undefined,
    reason: reason ? String(reason) : undefined,
    actorName: resolvedActorName ? String(resolvedActorName) : undefined,
    actorId: resolvedActorId ? String(resolvedActorId) : undefined,
    description: resolvedDescription ? String(resolvedDescription) : undefined,
  };
};

/**
 * Mask FCM token for safe development diagnostics without exposing sensitive tokens.
 */
const maskToken = (token: string): string => {
  if (!token || token.length < 12) return '***';
  return `${token.substring(0, 6)}...${token.slice(-6)}`;
};

class PushService {
  private activeToken: string | null = null;
  private tokenRefreshUnsubscribe: (() => void) | null = null;
  private foregroundMessageUnsubscribe: (() => void) | null = null;
  private activeUserId: string | null = null;

  /**
   * Request notification permission on Android 13+ (SDK 36) / iOS
   * Non-blocking, returns boolean result.
   */
  async requestNotificationPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (!hasPermission) {
          const status = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (status !== PermissionsAndroid.RESULTS.GRANTED) {
            if (__DEV__) {
              console.log('[PushService] POST_NOTIFICATIONS permission not granted:', status);
            }
            return false;
          }
        }
      }

      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (__DEV__) {
        console.log('[PushService] Notification authorization status:', authStatus, 'enabled:', enabled);
      }
      return enabled;
    } catch (err: any) {
      if (__DEV__) {
        console.log('[PushService] Permission request failed gracefully:', err?.message || err);
      }
      return false;
    }
  }

  /**
   * Check OS system notification permission status non-blockingly without prompting user.
   */
  async checkOSNotificationPermission(): Promise<boolean> {
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

  /**
   * Fetch current FCM registration token.
   * Returns token string or null. Never exposes full token in production logs.
   */
  async getFCMToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      if (token) {
        this.activeToken = token;
        if (__DEV__) {
          console.log('[PushService] Obtained FCM token (masked):', maskToken(token));
        }
      }
      return token;
    } catch (err: any) {
      if (__DEV__) {
        console.log('[PushService] Failed to obtain FCM token:', err?.message || err);
      }
      return null;
    }
  }

  /**
   * Register current FCM device token for authenticated user.
   * Idempotent & non-blocking. Sets up single token refresh and foreground message listeners.
   */
  async registerCurrentDeviceToken(userId: string): Promise<boolean> {
    if (!userId) return false;

    this.activeUserId = userId;

    try {
      // 1. Ensure permission handling runs non-blockingly
      await this.requestNotificationPermission();

      // 2. Fetch current FCM token
      const token = await this.getFCMToken();
      if (!token) {
        if (__DEV__) {
          console.log('[PushService] FCM token unavailable, registration skipped.');
        }
        return false;
      }

      // 3. Register token with backend push_devices via RPC
      const result = await api.registerPushDevice(token, Platform.OS);
      if (result.success) {
        if (__DEV__) {
          console.log('[PushService] Device token registered successfully for user:', userId);
        }
      } else {
        if (__DEV__) {
          console.log('[PushService] Device token registration RPC failed:', result.error);
        }
      }

      // 4. Ensure single token refresh & foreground message listeners
      this.setupTokenRefreshListener();
      this.setupForegroundMessageHandler();

      // 5. Initialize Android Notification Channel & Tap Event Listeners
      notificationService.initializeNotificationChannel();
      notificationService.setupNotificationEventListeners();

      return result.success;
    } catch (err: any) {
      if (__DEV__) {
        console.log('[PushService] Push device registration encountered non-fatal error:', err?.message || err);
      }
      return false;
    }
  }

  /**
   * Setup single FCM token refresh listener.
   */
  private setupTokenRefreshListener() {
    if (this.tokenRefreshUnsubscribe) {
      // Listener already active
      return;
    }

    try {
      this.tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (newToken: string) => {
        if (__DEV__) {
          console.log('[PushService] FCM token refreshed (masked):', maskToken(newToken));
        }
        this.activeToken = newToken;
        if (this.activeUserId) {
          await api.registerPushDevice(newToken, Platform.OS);
        }
      });
    } catch (err: any) {
      if (__DEV__) {
        console.log('[PushService] Failed to attach token refresh listener:', err?.message || err);
      }
    }
  }

  /**
   * Setup single FCM foreground message listener.
   * When valid SIT message arrives while app is in foreground, trigger syncEngine.syncAll() directly.
   */
  private setupForegroundMessageHandler() {
    if (this.foregroundMessageUnsubscribe) {
      // Listener already active
      return;
    }

    try {
      this.foregroundMessageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
        const payload = validateSITPayload(remoteMessage?.data);
        if (__DEV__) {
          console.log('[PushService] Foreground FCM message received:', payload || remoteMessage?.data);
        }

        if (payload) {
          syncEngine.syncAll().catch((err) => {
            if (__DEV__) {
              console.log('[PushService] Foreground sync triggered by FCM error:', err);
            }
          });
        }
      });
    } catch (err: any) {
      if (__DEV__) {
        console.log('[PushService] Failed to attach foreground message listener:', err?.message || err);
      }
    }
  }

  /**
   * Deactivate current device token during sign-out and clean up active listeners.
   */
  async deactivateCurrentDeviceToken(): Promise<boolean> {
    try {
      // Clean up token refresh & foreground message listeners
      if (this.tokenRefreshUnsubscribe) {
        this.tokenRefreshUnsubscribe();
        this.tokenRefreshUnsubscribe = null;
      }
      if (this.foregroundMessageUnsubscribe) {
        this.foregroundMessageUnsubscribe();
        this.foregroundMessageUnsubscribe = null;
      }

      const token = this.activeToken || (await this.getFCMToken());
      this.activeUserId = null;
      this.activeToken = null;

      if (!token) return true;

      const result = await api.deactivatePushDevice(token);
      if (__DEV__) {
        console.log('[PushService] Deactivated push device token result:', result.success);
      }
      return result.success;
    } catch (err: any) {
      if (__DEV__) {
        console.log('[PushService] Token deactivation encountered non-fatal error:', err?.message || err);
      }
      return false;
    }
  }
}

export const pushService = new PushService();
export default pushService;
