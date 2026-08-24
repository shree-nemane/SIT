module.exports = {
  createChannel: jest.fn().mockResolvedValue('presence_updates'),
  displayNotification: jest.fn().mockResolvedValue('notif_123'),
  onForegroundEvent: jest.fn().mockReturnValue(() => {}),
  onBackgroundEvent: jest.fn(),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  EventType: { PRESS: 1 },
};
