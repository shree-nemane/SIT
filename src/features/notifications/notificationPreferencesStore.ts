import { create } from 'zustand';
import kvStorage from '../../data/kvStorage';

const STORAGE_KEY = '@sit_notifications_enabled';

interface NotificationPreferencesState {
  notificationsEnabled: boolean;
  isLoaded: boolean;
  loadPreferences: () => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
}

export const useNotificationPreferencesStore = create<NotificationPreferencesState>((set) => ({
  notificationsEnabled: true,
  isLoaded: false,

  loadPreferences: async () => {
    try {
      const storedVal = await kvStorage.getItem(STORAGE_KEY);
      if (storedVal !== null) {
        const parsed = JSON.parse(storedVal);
        set({ notificationsEnabled: Boolean(parsed), isLoaded: true });
        if (__DEV__) {
          console.log('[NotificationPreferencesStore] Restored notificationsEnabled:', Boolean(parsed));
        }
      } else {
        set({ notificationsEnabled: true, isLoaded: true });
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[NotificationPreferencesStore] Failed to load notification preferences:', err);
      }
      set({ notificationsEnabled: true, isLoaded: true });
    }
  },

  setNotificationsEnabled: async (enabled: boolean) => {
    set({ notificationsEnabled: enabled });
    try {
      await kvStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
      if (__DEV__) {
        console.log('[NotificationPreferencesStore] Persisted notificationsEnabled:', enabled);
      }
    } catch (err) {
      if (__DEV__) {
        console.log('[NotificationPreferencesStore] Failed to persist notificationsEnabled:', err);
      }
    }
  },
}));

export default useNotificationPreferencesStore;
