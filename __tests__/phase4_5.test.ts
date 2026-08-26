import notificationService from '../src/features/notifications/notificationService';
import useNotificationPreferencesStore from '../src/features/notifications/notificationPreferencesStore';
import PresenceRepository from '../src/data/repositories/PresenceRepository';

// Mock Dependencies
jest.mock('@notifee/react-native', () => {
  const notifeeMock = {
    createChannel: jest.fn().mockResolvedValue('channel_id'),
    displayNotification: jest.fn().mockResolvedValue('notif_123'),
    onForegroundEvent: jest.fn(),
    onBackgroundEvent: jest.fn(),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    AndroidImportance: {
      HIGH: 4,
      DEFAULT: 3,
      LOW: 2,
    },
    EventType: {
      PRESS: 1,
    },
  };
  return {
    __esModule: true,
    default: notifeeMock,
    AndroidImportance: notifeeMock.AndroidImportance,
    EventType: notifeeMock.EventType,
  };
});

jest.mock('../src/database/db', () => ({
  getDB: jest.fn().mockReturnValue({
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    executeBatch: jest.fn().mockResolvedValue([]),
  }),
}));

describe('Phase 4.5 Reliability & Hardening Test Suite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useNotificationPreferencesStore.setState({ notificationsEnabled: true, isLoaded: true });
  });

  describe('1. Notification Channel Infrastructure', () => {
    it('registers presence_updates_v2 and presence_updates_quiet_v2 channels', async () => {
      const notifee = require('@notifee/react-native').default;
      await notificationService.initializeNotificationChannel();
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'presence_updates_v2',
          importance: 4, // HIGH
        })
      );
      expect(notifee.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'presence_updates_quiet_v2',
          importance: 2, // LOW
        })
      );
    });

    it('skips notification presentation completely when notifications are disabled', async () => {
      useNotificationPreferencesStore.setState({ notificationsEnabled: false, isLoaded: true });
      const notifee = require('@notifee/react-native').default;

      const result = await notificationService.showPresenceUpdateNotification({
        actorName: 'Alex',
        description: 'Testing disabled preference',
      });

      expect(result).toBeNull();
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });

    it('suppresses visible notification banner for PRESENCE_DELETED events', async () => {
      const notifee = require('@notifee/react-native').default;

      const result = await notificationService.showPresenceUpdateNotification({
        actorId: 'mem_123',
        groupId: 'grp_100',
        reason: 'PRESENCE_DELETED',
      });

      expect(result).toBeNull();
      expect(notifee.displayNotification).not.toHaveBeenCalled();
    });
  });

  describe('2. Member Detail Query Optimization', () => {
    it('executes single targeted SQLite query for getActivePresenceForMember', async () => {
      const { getDB } = require('../src/database/db');
      const db = getDB();

      await PresenceRepository.getActivePresenceForMember('mem_123');

      expect(db.execute).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.member_id = ?'),
        ['mem_123']
      );
    });
  });

  describe('3. Undo Presence Transaction Contract', () => {
    it('supports object target with memberId and presenceId in deletePresenceTransaction', async () => {
      const { getDB } = require('../src/database/db');
      const db = getDB();

      const success = await PresenceRepository.deletePresenceTransaction({
        memberId: 'mem_999',
        presenceId: 'pres_888',
      });

      expect(success).toBe(true);
      expect(db.executeBatch).toHaveBeenCalled();
    });
  });
});
