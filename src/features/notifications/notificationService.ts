import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import notificationNavigation from './notificationNavigation';
import MemberRepository from '../../data/repositories/MemberRepository';
import useNotificationPreferencesStore from './notificationPreferencesStore';
import { NotificationDestination } from './notificationTypes';
import { checkOSNotificationPermission } from './notificationPermissionHelper';

export interface PresenceNotificationOptions {
  presenceId?: string | null;
  actorName?: string | null;
  actorId?: string | null;
  groupId?: string;
  reason?: string;
  description?: string | null;
}

const CHANNEL_ID = 'presence_updates_v2';
const QUIET_CHANNEL_ID = 'presence_updates_quiet_v2';
let isChannelCreated = false;
let isEventListenerRegistered = false;

// 10-second deduplication sliding window
const DEDUPE_TTL_MS = 10 * 1000;
const recentEvents = new Map<string, number>();

const pruneExpiredDedupeKeys = () => {
  const now = Date.now();
  for (const [key, timestamp] of recentEvents.entries()) {
    if (now - timestamp > DEDUPE_TTL_MS) {
      recentEvents.delete(key);
    }
  }
};

const truncateNotificationText = (text: string, maxLength: number = 65): string => {
  const singleLine = text.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.substring(0, maxLength).trim()}…`;
};

export const notificationService = {
  /**
   * Decision Layer for Visible Notification Banners:
   * Checks preference loading status, user app preference, OS system permissions, and deduplication.
   * NEVER affects FCM reception or background syncEngine.syncAll().
   */
  async shouldShowPresenceNotification(options?: PresenceNotificationOptions): Promise<boolean> {
    // 0. Silent deletion events NEVER show visible notification banners
    if (options?.reason === 'PRESENCE_DELETED') {
      if (__DEV__) {
        // console.log('[NotificationService] PRESENCE_DELETED event received — skipping visible notification banner for silent sync.');
      }
      return false;
    }

    let prefs = useNotificationPreferencesStore.getState();

    // 1. Conservative safety: if preferences store is not loaded yet, load preferences on demand
    if (!prefs.isLoaded) {
      await useNotificationPreferencesStore.getState().loadPreferences();
      prefs = useNotificationPreferencesStore.getState();
    }

    // 2. Check user in-app preference
    if (!prefs.notificationsEnabled) {
      if (__DEV__) {
        // console.log('[NotificationService] Quiet Mode active (notificationsEnabled is false) — skipping visible notification.');
      }
      return false;
    }

    // 3. Check OS notification permission
    const osPermissionGranted = await checkOSNotificationPermission();
    if (!osPermissionGranted) {
      if (__DEV__) {
        // console.log('[NotificationService] OS notification permission denied — skipping visible notification.');
      }
      return false;
    }

    // 4. Primary Deterministic Deduplication Key (presenceId primary, fallback to actorId:groupId:reason)
    const dedupeKey = options?.presenceId
      ? `presence_${options.presenceId}`
      : `${options?.actorId || 'unknown'}:${options?.groupId || 'unknown'}:${options?.reason || 'checkin'}`;

    const now = Date.now();
    const lastSeen = recentEvents.get(dedupeKey);
    if (lastSeen && now - lastSeen < DEDUPE_TTL_MS) {
      if (__DEV__) {
        // console.log('[NotificationService] Suppressed duplicate notification event:', dedupeKey);
      }
      return false;
    }

    recentEvents.set(dedupeKey, now);
    pruneExpiredDedupeKeys();
    return true;
  },

  /**
   * Initialize Android Notification Channels for Presence Updates.
   * Registers both standard High-importance channel AND Quiet channel once.
   * Safe to call repeatedly across app startup lifecycles.
   */
  async initializeNotificationChannel(): Promise<string> {
    if (isChannelCreated) return CHANNEL_ID;

    try {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Presence updates',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });

      await notifee.createChannel({
        id: QUIET_CHANNEL_ID,
        name: 'Quiet presence updates',
        importance: AndroidImportance.LOW,
        sound: undefined,
        vibration: false,
      });

      isChannelCreated = true;
      if (__DEV__) {
        // console.log('[NotificationService] Android notification channels (high & quiet) initialized.');
      }
      return CHANNEL_ID;
    } catch (err: any) {
      if (__DEV__) {
        // console.log('[NotificationService] Failed to create notification channel:', err?.message || err);
      }
      return CHANNEL_ID;
    }
  },

  /**
   * Display a visible local notification for a presence update event.
   * Format:
   * Title: "{Name} • Circle Update"
   * Body:  "{truncatedDescription}" or "{Name} just checked in with your circle."
   */
  async showPresenceUpdateNotification(options?: PresenceNotificationOptions): Promise<string | null> {
    try {
      const shouldShow = await this.shouldShowPresenceNotification(options);
      if (!shouldShow) {
        return null;
      }

      await this.initializeNotificationChannel();

      // Tier 1: Explicit payload actorName & description
      let resolvedActorName = options?.actorName;
      let resolvedDescription = options?.description;

      // Tier 2: Lookup actorName from MemberRepository if missing in payload
      if (options?.actorId && (!resolvedActorName || typeof resolvedActorName !== 'string' || !resolvedActorName.trim())) {
        try {
          const localMember = await MemberRepository.getMember(options.actorId);
          if (localMember?.displayName) {
            resolvedActorName = localMember.displayName;
          }
        } catch {}
      }

      // Format title and body for warm, human presence notifications
      let titleText = 'Stay in Touch';
      let bodyText = 'Someone in your circle shared a status update.';

      const cleanName = (typeof resolvedActorName === 'string' && resolvedActorName.trim()) ? resolvedActorName.trim() : null;
      const validName = cleanName && cleanName.toLowerCase() !== 'undefined' && cleanName.toLowerCase() !== 'null' ? cleanName : null;

      const cleanDesc = (typeof resolvedDescription === 'string' && resolvedDescription.trim()) ? resolvedDescription.trim() : null;

      if (validName) {
        titleText = `${validName} • Circle Update`;
        if (cleanDesc) {
          bodyText = `"${truncateNotificationText(cleanDesc, 65)}"`;
        } else {
          bodyText = `${validName} just checked in with your circle.`;
        }
      } else if (cleanDesc) {
        titleText = 'Circle Update';
        bodyText = `"${truncateNotificationText(cleanDesc, 65)}"`;
      }

      const notificationId = await notifee.displayNotification({
        title: titleText,
        body: bodyText,
        data: {
          version: '1',
          type: 'PRESENCE_UPDATE',
          groupId: options?.groupId || '',
          presenceId: options?.presenceId || '',
          actorId: options?.actorId || '',
          target: 'Today',
        },
        android: {
          channelId: CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          smallIcon: 'app_notification_icon',
          pressAction: {
            id: 'default',
          },
        },
      });

      if (__DEV__) {
        // console.log('[NotificationService] Presence notification displayed:', {
          // id: notificationId,
          // title: titleText,
          // body: bodyText,
        // });
      }

      return notificationId;
    } catch (err: any) {
      if (__DEV__) {
        // console.log('[NotificationService] Failed to display presence notification gracefully:', err?.message || err);
      }
      return null;
    }
  },

  /**
   * Register Notifee notification press event listeners.
   */
  setupNotificationEventListeners(): void {
    if (isEventListenerRegistered) return;
    isEventListenerRegistered = true;

    // Foreground notification press handler
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        if (__DEV__) {
          // console.log('[NotificationService] Foreground notification tapped:', detail.notification?.data);
        }
        const rawTarget = (detail.notification?.data?.target as string) || 'Today';
        const target: NotificationDestination = (['Today', 'Group', 'Profile', 'CheckIn', 'Settings'].includes(rawTarget))
          ? (rawTarget as NotificationDestination)
          : 'Today';

        notificationNavigation.setPendingDestination(target, {
          groupId: detail.notification?.data?.groupId as string | undefined,
          presenceId: detail.notification?.data?.presenceId as string | undefined,
          actorId: detail.notification?.data?.actorId as string | undefined,
        });
      }
    });

    // Check if app was launched from a notification press (terminated app startup)
    notifee.getInitialNotification().then((initialNotification) => {
      if (initialNotification && initialNotification.pressAction) {
        if (__DEV__) {
          // console.log(
            // '[NotificationService] App launched from terminated state via notification:',
            // initialNotification.notification.data
          // );
        }
        const rawTarget = (initialNotification.notification?.data?.target as string) || 'Today';
        const target: NotificationDestination = (['Today', 'Group', 'Profile', 'CheckIn', 'Settings'].includes(rawTarget))
          ? (rawTarget as NotificationDestination)
          : 'Today';

        notificationNavigation.setPendingDestination(target, {
          groupId: initialNotification.notification?.data?.groupId as string | undefined,
          presenceId: initialNotification.notification?.data?.presenceId as string | undefined,
          actorId: initialNotification.notification?.data?.actorId as string | undefined,
        });
      }
    });
  },
};

// Register Notifee Background Event Handler (required for background tap handling)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.PRESS) {
    if (__DEV__) {
      // console.log('[NotificationService] Background notification tapped:', detail.notification?.data);
    }
    const rawTarget = (detail.notification?.data?.target as string) || 'Today';
    const target: NotificationDestination = (['Today', 'Group', 'Profile', 'CheckIn', 'Settings'].includes(rawTarget))
      ? (rawTarget as NotificationDestination)
      : 'Today';

    notificationNavigation.setPendingDestination(target, {
      groupId: detail.notification?.data?.groupId as string | undefined,
      presenceId: detail.notification?.data?.presenceId as string | undefined,
      actorId: detail.notification?.data?.actorId as string | undefined,
    });
  }
});

export default notificationService;
