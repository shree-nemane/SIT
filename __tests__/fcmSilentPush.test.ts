import { NativeModules } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import pushService, { validateSITPayload } from '../src/features/notifications/pushService';
import syncEngine from '../src/features/sync/syncEngine';
import { api } from '../src/data/api';

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

    it('should return null for payloads without a `type` property', () => {
      expect(validateSITPayload({})).toBeNull();
      expect(validateSITPayload({ groupId: 'grp_1', reason: 'MEMBER_CHECKIN' })).toBeNull();
    });

    it('should extract valid SIT payload with type, groupId, and reason', () => {
      const rawData = {
        type: 'PRESENCE_UPDATE',
        groupId: 'grp_100',
        reason: 'MEMBER_CHECKIN',
        extraSecretKey: 'should_not_leak',
      };

      const parsed = validateSITPayload(rawData);

      expect(parsed).toEqual({
        type: 'PRESENCE_UPDATE',
        groupId: 'grp_100',
        reason: 'MEMBER_CHECKIN',
      });
    });

    it('should handle payload with type only', () => {
      const rawData = { type: 'PRESENCE_UPDATE' };
      const parsed = validateSITPayload(rawData);

      expect(parsed).toEqual({
        type: 'PRESENCE_UPDATE',
        groupId: undefined,
        reason: undefined,
      });
    });
  });

  describe('2. Foreground FCM Silent Push Handler', () => {
    it('should trigger syncEngine.syncAll() when a valid SIT message arrives in foreground', async () => {
      let foregroundHandler: ((msg: any) => Promise<void>) | null = null;
      mockMessaging.onMessage.mockImplementation((cb: any) => {
        foregroundHandler = cb;
        return jest.fn();
      });

      await pushService.registerCurrentDeviceToken('user_test_123');

      expect(mockMessaging.onMessage).toHaveBeenCalled();
      expect(foregroundHandler).toBeInstanceOf(Function);

      // Simulate incoming valid FCM silent push message
      const validMessage = {
        data: {
          type: 'PRESENCE_UPDATE',
          groupId: 'grp_abc',
          reason: 'MEMBER_CHECKIN',
        },
      };

      await foregroundHandler!(validMessage);

      expect(syncEngine.syncAll).toHaveBeenCalledTimes(1);
    });

    it('should NOT trigger syncEngine.syncAll() when invalid FCM message arrives in foreground', async () => {
      let foregroundHandler: ((msg: any) => Promise<void>) | null = null;
      mockMessaging.onMessage.mockImplementation((cb: any) => {
        foregroundHandler = cb;
        return jest.fn();
      });

      await pushService.registerCurrentDeviceToken('user_test_123');

      expect(mockMessaging.onMessage).toHaveBeenCalled();
      expect(foregroundHandler).toBeInstanceOf(Function);

      const invalidMessage = {
        data: {
          randomKey: 'no_type_field',
        },
      };

      await foregroundHandler!(invalidMessage);

      expect(syncEngine.syncAll).not.toHaveBeenCalled();
    });
  });

  describe('3. Background FCM Silent Push Handler & WorkManager Dispatch', () => {
    let backgroundHandler: ((msg: any) => Promise<void>) | null = null;

    beforeAll(() => {
      NativeModules.WidgetBridge = {
        triggerBackgroundSync: jest.fn().mockResolvedValue(true),
      };

      require('../index');

      const mockInstance = messaging();
      const calls = mockInstance.setBackgroundMessageHandler.mock.calls;
      if (calls.length > 0) {
        backgroundHandler = calls[0][0];
      }
    });

    beforeEach(() => {
      NativeModules.WidgetBridge = {
        triggerBackgroundSync: jest.fn().mockResolvedValue(true),
      };
    });

    it('should trigger NativeModules.WidgetBridge.triggerBackgroundSync() on valid background message', async () => {
      expect(backgroundHandler).toBeInstanceOf(Function);

      const validBackgroundMessage = {
        data: {
          type: 'PRESENCE_UPDATE',
          groupId: 'grp_xyz',
          reason: 'MEMBER_CHECKIN',
        },
      };

      await backgroundHandler!(validBackgroundMessage);

      expect(NativeModules.WidgetBridge.triggerBackgroundSync).toHaveBeenCalledTimes(1);
    });

    it('should NOT trigger WidgetBridge when background FCM payload is invalid', async () => {
      expect(backgroundHandler).toBeInstanceOf(Function);

      const invalidBackgroundMessage = {
        data: {
          unrecognizedData: 'true',
        },
      };

      await backgroundHandler!(invalidBackgroundMessage);

      expect(NativeModules.WidgetBridge.triggerBackgroundSync).not.toHaveBeenCalled();
    });
  });
});
