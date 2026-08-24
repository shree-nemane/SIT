/**
 * Notification Types and Contracts for SIT Notification Subsystem
 */

export type NotificationDestination = 'Today' | 'Group' | 'Profile' | 'CheckIn' | 'Settings';

export interface SITNotificationPayload {
  version?: string;
  type: string;
  groupId: string;
  presenceId?: string;
  actorId?: string;
  actorName?: string;
  description?: string;
  reason?: string;
  [key: string]: any;
}

export interface PendingNotificationNavigation {
  destination: NotificationDestination;
  groupId?: string;
  presenceId?: string;
  actorId?: string;
  createdAt: number;
}
