import { getDB } from '../../database/db';
import { Presence } from '../../features/presence/types';
import imageResolver from '../../features/media/imageResolver';

export interface SyncOperationInput {
  id: string;
  entityType: 'presence' | 'image' | 'member';
  entityId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string;
  createdAt: string;
}

export const PresenceRepository = {
  /**
   * Atomic Check-In transaction:
   * Saves active presence (UPSERT via INSERT OR REPLACE) AND enqueues pending sync item in one SQLite transaction.
   */
  async saveCheckInTransaction(
    presence: Presence,
    syncOp: SyncOperationInput
  ): Promise<boolean> {
    const db = getDB();
    try {
      await db.executeBatch([
        [
          `INSERT OR REPLACE INTO presences (id, member_id, description, image_id, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [
            presence.id,
            presence.memberId,
            presence.description,
            presence.imageId || null,
            presence.updatedAt,
            presence.syncStatus,
          ],
        ],
        [
          `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at, retry_count)
           VALUES (?, ?, ?, ?, ?, ?, 0);`,
          [
            syncOp.id,
            syncOp.entityType,
            syncOp.entityId,
            syncOp.operation,
            syncOp.payload,
            syncOp.createdAt,
          ],
        ],
      ]);
      return true;
    } catch (error) {
      // console.error('[PresenceRepository] Check-In transaction failed:', error);
      return false;
    }
  },

  /**
   * Fetch current active presence for a specific member
   */
  async getActivePresence(memberId: string): Promise<Presence | null> {
    const db = getDB();
    try {
      const res = await db.execute(
        'SELECT id, member_id, description, image_id, updated_at, sync_status FROM presences WHERE member_id = ? LIMIT 1;',
        [memberId]
      );
      if (res.rows && res.rows.length > 0) {
        const row: any = res.rows[0];
        return {
          id: row.id,
          memberId: row.member_id,
          description: row.description,
          imageId: row.image_id,
          updatedAt: row.updated_at,
          syncStatus: row.sync_status,
        };
      }
      return null;
    } catch (error) {
      // console.error('[PresenceRepository] Failed to get active presence:', error);
      return null;
    }
  },

  /**
   * Fetch all group presences joined with member display names and local displayable image URIs
   */
  async getAllGroupPresences(): Promise<
    Array<{
      presenceId: string;
      memberId: string;
      displayName: string;
      profileImageId: string | null;
      profileImageLocalPath: string | null;
      description: string;
      imageId: string | null;
      presenceImageLocalPath: string | null;
      updatedAt: string;
      syncStatus: string;
    }>
  > {
    const db = getDB();
    try {
      const res = await db.execute(
        `SELECT 
           p.id as presence_id, 
           p.member_id, 
           m.display_name, 
           m.profile_image_id, 
           pimg.storage_path as profile_storage_path,
           p.description, 
           p.image_id, 
           img.storage_path as presence_storage_path,
           p.updated_at, 
           p.sync_status
         FROM presences p
         LEFT JOIN members m ON p.member_id = m.id
         LEFT JOIN images img ON p.image_id = img.id
         LEFT JOIN images pimg ON m.profile_image_id = pimg.id
         ORDER BY p.updated_at DESC;`
      );
      if (!res.rows) return [];
      return await Promise.all(
        Array.from(res.rows).map(async (row: any) => {
          const profileLocalPath = await imageResolver.resolveImageUri(
            row.profile_image_id,
            row.profile_storage_path
          );
          const presenceLocalPath = await imageResolver.resolveImageUri(
            row.image_id,
            row.presence_storage_path
          );
          return {
            presenceId: row.presence_id,
            memberId: row.member_id,
            displayName: row.display_name || 'Group Member',
            profileImageId: row.profile_image_id || null,
            profileImageLocalPath: profileLocalPath,
            description: row.description,
            imageId: row.image_id || null,
            presenceImageLocalPath: presenceLocalPath,
            updatedAt: row.updated_at,
            syncStatus: row.sync_status,
          };
        })
      );
    } catch (error) {
      // console.error('[PresenceRepository] Failed to get group presences:', error);
      return [];
    }
  },

  /**
   * Fetch active presence for a single member with resolved local displayable image URIs.
   * Efficient 1-row SQLite query for MemberDetailScreen.
   */
  async getActivePresenceForMember(memberId: string): Promise<{
    presenceId: string;
    memberId: string;
    displayName: string;
    profileImageId: string | null;
    profileImageLocalPath: string | null;
    description: string;
    imageId: string | null;
    presenceImageLocalPath: string | null;
    updatedAt: string;
    syncStatus: string;
  } | null> {
    const db = getDB();
    try {
      const res = await db.execute(
        `SELECT 
           p.id as presence_id, 
           p.member_id, 
           m.display_name, 
           m.profile_image_id, 
           pimg.storage_path as profile_storage_path,
           p.description, 
           p.image_id, 
           img.storage_path as presence_storage_path,
           p.updated_at, 
           p.sync_status
         FROM presences p
         LEFT JOIN members m ON p.member_id = m.id
         LEFT JOIN images img ON p.image_id = img.id
         LEFT JOIN images pimg ON m.profile_image_id = pimg.id
         WHERE p.member_id = ?
         LIMIT 1;`,
        [memberId]
      );
      if (!res.rows || res.rows.length === 0) return null;
      const row: any = res.rows[0];
      const profileLocalPath = await imageResolver.resolveImageUri(
        row.profile_image_id,
        row.profile_storage_path
      );
      const presenceLocalPath = await imageResolver.resolveImageUri(
        row.image_id,
        row.presence_storage_path
      );
      return {
        presenceId: row.presence_id,
        memberId: row.member_id,
        displayName: row.display_name || 'Circle Member',
        profileImageId: row.profile_image_id || null,
        profileImageLocalPath: profileLocalPath,
        description: row.description,
        imageId: row.image_id || null,
        presenceImageLocalPath: presenceLocalPath,
        updatedAt: row.updated_at,
        syncStatus: row.sync_status,
      };
    } catch (error) {
      // console.error('[PresenceRepository] Failed to get member active presence:', error);
      return null;
    }
  },

  /**
   * Atomic Delete Presence transaction:
   * Removes presence from local SQLite AND enqueues a DELETE operation item in sync_queue.
   * Supports input as memberId string or structured { memberId, presenceId } object.
   */
  async deletePresenceTransaction(
    target: string | { memberId: string; presenceId?: string }
  ): Promise<boolean> {
    const memberId = typeof target === 'string' ? target : target.memberId;
    const db = getDB();
    try {
      const nowIso = new Date().toISOString();
      const syncOpId = `op_${Date.now()}`;
      const payload = JSON.stringify({ memberId, deletedAt: nowIso });

      await db.executeBatch([
        ['DELETE FROM presences WHERE member_id = ?;', [memberId]],
        [
          `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at, retry_count)
           VALUES (?, 'presence', ?, 'DELETE', ?, ?, 0);`,
          [syncOpId, memberId, payload, nowIso],
        ],
      ]);
      return true;
    } catch (error) {
      // console.error('[PresenceRepository] Failed to delete presence locally:', error);
      return false;
    }
  },
};

export default PresenceRepository;
