import { NativeModules } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import pushService, { validateSITPayload } from '../src/features/notifications/pushService';
import syncEngine from '../src/features/sync/syncEngine';
import backgroundSyncTask from '../src/features/sync/backgroundSyncTask';

// Mock backgroundSyncTask
jest.mock('../src/features/sync/backgroundSyncTask', () => jest.fn().mockResolvedValue(undefined));

// Mock syncEngine.syncAll
jest.mock('../src/features/sync/syncEngine', () => ({
  syncAll: jest.fn().mockResolvedValue(true),
  subscribe: jest.fn(),
  notifyListeners: jest.fn(),
}));

// Mock api.registerPushDevice
jest.mock('../src/data/api', () => ({
  api: {
    registerPushDevice: jest.fn().mockResolvedValue({ success: true }),
    deactivatePushDevice: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock @notifee/react-native
jest.mock('@notifee/react-native', () => ({
  createChannel: jest.fn().mockImplementation(async (channel) => channel?.id || 'presence_updates_v2'),
  displayNotification: jest.fn().mockResolvedValue('notif_123'),
  onForegroundEvent: jest.fn().mockReturnValue(() => {}),
  onBackgroundEvent: jest.fn(),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  EventType: { PRESS: 1 },
}));

describe('FCM Silent Push Mechanism Test Suite', () => {
  let mockMessaging: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMessaging = messaging();
    await pushService.deactivateCurrentDeviceToken();
  });

  describe('1. SIT Data Payload Validation (validateSITPayload)', () => {
    it('should return null for undefined or null payloads', () => {
      expect(validateSITPayload(undefined)).toBeNull();
      expect(validateSITPayload(null as any)).toBeNull();
    });

    it('should return null for non-object payloads', () => {
      expect(validateSITPayload('invalid_string' as any)).toBeNull();
      expect(validateSITPayload(12345 as any)).toBeNull();
    });

    it('should extract valid payload fields', () => {
      const raw = {
        type: 'PRESENCE_UPDATE',
        groupId: 'grp_123',
        presenceId: 'pres_789',
        actorId: 'user_456',
        actorName: 'Alice',
        reason: 'MEMBER_CHECKIN',
        description: 'Checking in',
      };
      const parsed = validateSITPayload(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.groupId).toBe('grp_123');
      expect(parsed?.actorName).toBe('Alice');
    });
  });

  describe('2. Device Token Registration & State Management', () => {
    it('should register token and update store', async () => {
      await pushService.registerCurrentDeviceToken('user_test_123');
      expect(pushService.getActiveToken()).toBe('mock_fcm_token_123');
    });

    it('should deactivate device token on logout', async () => {
      await pushService.registerCurrentDeviceToken('user_test_123');
      await pushService.deactivateCurrentDeviceToken();
      expect(pushService.getActiveToken()).toBeNull();
    });
  });

  describe('3. Background FCM Silent Push Handler & Direct Headless Execution', () => {
    let backgroundHandler: ((msg: any) => Promise<void>) | null = null;

    beforeAll(() => {
      require('../index');

      const mockInstance = messaging();
      const calls = (mockInstance.setBackgroundMessageHandler as jest.Mock).mock.calls;
      if (calls.length > 0) {
        backgroundHandler = calls[0][0];
      }
    });

    it('should execute direct backgroundSyncTask on valid background message', async () => {
      expect(backgroundHandler).toBeInstanceOf(Function);

      const validBackgroundMessage = {
        data: {
          type: 'PRESENCE_UPDATE',
          groupId: 'grp_xyz',
          reason: 'MEMBER_CHECKIN',
        },
      };

      await backgroundHandler!(validBackgroundMessage);

      expect(backgroundSyncTask).toHaveBeenCalledWith({
        source: 'background_fcm',
        reason: 'MEMBER_CHECKIN',
      });
    });

    it('should NOT execute backgroundSyncTask when background FCM payload is invalid', async () => {
      expect(backgroundHandler).toBeInstanceOf(Function);

      const invalidBackgroundMessage = {
        data: {
          unrecognizedData: 'true',
        },
      };

      await backgroundHandler!(invalidBackgroundMessage);

      expect(backgroundSyncTask).not.toHaveBeenCalled();
    });
  });

  describe('4. Quiet Mode & Notification Decision Layer', () => {
    beforeEach(() => {
      const useNotificationPreferencesStore = require('../src/features/notifications/notificationPreferencesStore').default;
      useNotificationPreferencesStore.setState({ notificationsEnabled: true, isLoaded: true });
    });

    it('should suppress notification presentation when Quiet Mode is active', async () => {
      const useNotificationPreferencesStore = require('../src/features/notifications/notificationPreferencesStore').default;
      useNotificationPreferencesStore.setState({ notificationsEnabled: false, isLoaded: true });

      const notificationService = require('../src/features/notifications/notificationService').default;
      const notifee = require('@notifee/react-native');

      const result = await notificationService.showPresenceUpdateNotification({
        presenceId: 'pres_quiet_1',
        reason: 'MEMBER_CHECKIN',
      });

      expect(result).toBeNull();
      expect(notifee.displayNotification).not.toHaveBeenCalled();

      // Reset preference back to default ON
      useNotificationPreferencesStore.setState({ notificationsEnabled: true, isLoaded: true });
    });

    it('should suppress visible notification for PRESENCE_DELETED while still executing syncEngine.syncAll()', async () => {
      const notifee = require('@notifee/react-native');
      const notificationService = require('../src/features/notifications/notificationService').default;

      let foregroundHandler: ((msg: any) => Promise<void>) | null = null;
      mockMessaging.onMessage.mockImplementation((cb: any) => {
        foregroundHandler = cb;
        return jest.fn();
      });

      await pushService.registerCurrentDeviceToken('user_test_123');

      const deletePresenceMsg = {
        data: {
          type: 'PRESENCE_UPDATE',
          groupId: 'grp_123',
          presenceId: 'pres_del_99',
          actorId: 'user_456',
          reason: 'PRESENCE_DELETED',
        },
      };

      await foregroundHandler!(deletePresenceMsg);

      // Verify sync executed
      expect(syncEngine.syncAll).toHaveBeenCalled();

      // Verify notificationService decision layer returns null / suppresses notification for PRESENCE_DELETED
      const notifResult = await notificationService.showPresenceUpdateNotification({
        presenceId: 'pres_del_99',
        reason: 'PRESENCE_DELETED',
      });
      expect(notifResult).toBeNull();
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });
  });
});
