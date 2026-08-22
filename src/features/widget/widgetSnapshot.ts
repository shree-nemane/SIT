import { NativeModules, Platform } from 'react-native';
import PresenceRepository from '../../data/repositories/PresenceRepository';

const { WidgetBridge } = NativeModules;

export interface WidgetMemberSnapshot {
  memberId: string;
  displayName: string;
  description: string;
  imageLocalPath: string | null;
  profileImageLocalPath: string | null;
  imageWidth?: number;
  imageHeight?: number;
  updatedAt: string;
}

export interface WidgetSnapshotData {
  version: number;
  updatedAt: string;
  members: WidgetMemberSnapshot[];
}

export const widgetSnapshotService = {
  /**
   * Regenerate group widget snapshot projection from local SQLite database
   * and publish update to native Android widget.
   */
  async updateAndNotifyWidget(): Promise<boolean> {
    if (Platform.OS !== 'android' || !WidgetBridge) {
      return false;
    }

    try {
      const groupPresences = await PresenceRepository.getAllGroupPresences();

      const snapshot: WidgetSnapshotData = {
        version: 1,
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        members: groupPresences.map((p) => ({
          memberId: p.memberId,
          displayName: p.displayName,
          description: p.description,
          imageLocalPath: p.presenceImageLocalPath || null,
          profileImageLocalPath: p.profileImageLocalPath || null,
          updatedAt: new Date(p.updatedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        })),
      };

      const jsonString = JSON.stringify(snapshot);
      await WidgetBridge.updateWidgetSnapshot(jsonString);
      return true;
    } catch (error) {
      console.error('[WidgetSnapshot] Failed to update widget snapshot:', error);
      return false;
    }
  },
};

export default widgetSnapshotService;
