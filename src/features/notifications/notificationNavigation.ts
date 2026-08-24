import kvStorage from '../../data/kvStorage';
import {
  NotificationDestination,
  PendingNotificationNavigation,
} from './notificationTypes';

const STORAGE_KEY = '@sit_pending_notification_navigation';
const DESTINATION_EXPIRATION_MS = 5 * 60 * 1000; // 5-minute expiration window

let inMemoryPendingDestination: PendingNotificationNavigation | null = null;
let isStorageLoaded = false;

export const notificationNavigation = {
  /**
   * Set structured pending notification destination with timestamp.
   * Stores in-memory AND persists to kvStorage so navigation survives cold-starts.
   */
  async setPendingDestination(
    destination: NotificationDestination = 'Today',
    context?: { groupId?: string; presenceId?: string; actorId?: string }
  ): Promise<void> {
    const pendingObj: PendingNotificationNavigation = {
      destination,
      groupId: context?.groupId,
      presenceId: context?.presenceId,
      actorId: context?.actorId,
      createdAt: Date.now(),
    };

    inMemoryPendingDestination = pendingObj;

    try {
      await kvStorage.setItem(STORAGE_KEY, JSON.stringify(pendingObj));
    } catch (err) {
      if (__DEV__) {
        console.log('[NotificationNavigation] Failed to persist pending destination to storage:', err);
      }
    }

    if (__DEV__) {
      console.log('[NotificationNavigation] Set pending destination:', pendingObj);
    }
  },

  /**
   * Restore pending navigation from kvStorage during cold start.
   */
  async loadStoredDestination(): Promise<PendingNotificationNavigation | null> {
    if (isStorageLoaded) return inMemoryPendingDestination;

    try {
      const storedJson = await kvStorage.getItem(STORAGE_KEY);
      if (storedJson) {
        const parsed: PendingNotificationNavigation = JSON.parse(storedJson);
        const age = Date.now() - (parsed.createdAt || 0);

        if (age <= DESTINATION_EXPIRATION_MS) {
          inMemoryPendingDestination = parsed;
        } else {
          // Expired pending destination
          await kvStorage.removeItem(STORAGE_KEY);
          inMemoryPendingDestination = null;
        }
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[NotificationNavigation] Error restoring stored pending destination:', err);
      }
    } finally {
      isStorageLoaded = true;
    }

    return inMemoryPendingDestination;
  },

  /**
   * Read pending destination WITHOUT consuming it.
   */
  getPendingDestination(): PendingNotificationNavigation | null {
    if (!inMemoryPendingDestination) return null;
    const age = Date.now() - (inMemoryPendingDestination.createdAt || 0);
    if (age > DESTINATION_EXPIRATION_MS) {
      inMemoryPendingDestination = null;
      kvStorage.removeItem(STORAGE_KEY).catch(() => {});
      return null;
    }
    return inMemoryPendingDestination;
  },

  hasPendingDestination(): boolean {
    return this.getPendingDestination() !== null;
  },

  /**
   * Consume and clear pending destination (single-use retrieval).
   */
  consumePendingDestination(): PendingNotificationNavigation | null {
    const dest = this.getPendingDestination();
    inMemoryPendingDestination = null;
    kvStorage.removeItem(STORAGE_KEY).catch(() => {});
    if (dest && __DEV__) {
      console.log('[NotificationNavigation] Consumed pending destination:', dest);
    }
    return dest;
  },

  async clearPendingDestination(): Promise<void> {
    inMemoryPendingDestination = null;
    try {
      await kvStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
};

export default notificationNavigation;
