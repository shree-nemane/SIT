import { getDB } from '../../database/db';
import imageResolver from '../../features/media/imageResolver';

export interface LocalMemberProfile {
  id: string;
  groupId: string;
  displayName: string;
  profileImageId: string | null;
  profileImageLocalPath: string | null;
}

export interface GroupDetailInfo {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members: Array<{
    id: string;
    displayName: string;
    profileImageId: string | null;
    profileImageLocalPath: string | null;
    joinedAt: string;
    isOwner: boolean;
  }>;
}

export const MemberRepository = {
  /**
   * Upsert Group metadata in local SQLite
   */
  async upsertGroup(group: {
    id: string;
    name: string;
    ownerId: string;
    createdAt?: string;
  }): Promise<boolean> {
    const db = getDB();
    try {
      const createdAt = group.createdAt || new Date().toISOString();
      await db.execute(
        `INSERT INTO groups (id, name, owner_id, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           owner_id = excluded.owner_id,
           created_at = excluded.created_at;`,
        [group.id, group.name, group.ownerId, createdAt]
      );
      return true;
    } catch (error) {
      console.error('[MemberRepository] Failed to upsert group:', error);
      return false;
    }
  },

  /**
   * Upsert Member record in local SQLite (NULL profile_image_id is authoritative)
   */
  async upsertMember(member: {
    id: string;
    groupId: string;
    displayName: string;
    profileImageId?: string | null;
    joinedAt?: string;
    createdAt?: string;
  }): Promise<boolean> {
    const db = getDB();
    try {
      const nowIso = new Date().toISOString();
      const joinedAt = member.joinedAt || nowIso;
      const createdAt = member.createdAt || nowIso;
      await db.execute(
        `INSERT INTO members (id, group_id, display_name, profile_image_id, joined_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           group_id = excluded.group_id,
           display_name = excluded.display_name,
           profile_image_id = excluded.profile_image_id,
           joined_at = excluded.joined_at;`,
        [
          member.id,
          member.groupId,
          member.displayName,
          member.profileImageId ?? null,
          joinedAt,
          createdAt,
        ]
      );
      return true;
    } catch (error) {
      console.error('[MemberRepository] Failed to upsert member:', error);
      return false;
    }
  },

  /**
   * Fetch current member profile from local SQLite with profileImageLocalPath
   */
  async getMember(memberId: string): Promise<LocalMemberProfile | null> {
    const db = getDB();
    try {
      const res = await db.execute(
        `SELECT m.id, m.group_id, m.display_name, m.profile_image_id, img.storage_path as profile_storage_path
         FROM members m
         LEFT JOIN images img ON m.profile_image_id = img.id
         WHERE m.id = ? LIMIT 1;`,
        [memberId]
      );
      if (res.rows && res.rows.length > 0) {
        const row: any = res.rows[0];
        let profileLocalPath = await imageResolver.resolveImageUri(
          row.profile_image_id,
          row.profile_storage_path
        );
        if (!profileLocalPath) {
          profileLocalPath = imageResolver.getLocalFileUri(memberId);
        }
        return {
          id: row.id,
          groupId: row.group_id,
          displayName: row.display_name,
          profileImageId: row.profile_image_id || null,
          profileImageLocalPath: profileLocalPath,
        };
      }
      return null;
    } catch (error) {
      console.error('[MemberRepository] Failed to get member:', error);
      return null;
    }
  },

  /**
   * Fetch Group Details & Member list from local SQLite (Local-first)
   */
  async getGroupInfoAndMembers(groupId: string): Promise<GroupDetailInfo | null> {
    const db = getDB();
    try {
      const groupRes = await db.execute(
        'SELECT id, name, owner_id, created_at FROM groups WHERE id = ? LIMIT 1;',
        [groupId]
      );

      let groupName = 'Private Group';
      let ownerId = '';
      let createdAt = new Date().toISOString();

      if (groupRes.rows && groupRes.rows.length > 0) {
        const g: any = groupRes.rows[0];
        groupName = g.name;
        ownerId = g.owner_id;
        createdAt = g.created_at;
      }

      const membersRes = await db.execute(
        `SELECT m.id, m.display_name, m.profile_image_id, img.storage_path as profile_storage_path, m.joined_at
         FROM members m
         LEFT JOIN images img ON m.profile_image_id = img.id
         WHERE m.group_id = ?
         ORDER BY m.joined_at ASC;`,
        [groupId]
      );

      const membersList = membersRes.rows
        ? await Promise.all(
            Array.from(membersRes.rows).map(async (m: any) => {
              let profileLocalPath = await imageResolver.resolveImageUri(
                m.profile_image_id,
                m.profile_storage_path
              );
              if (!profileLocalPath) {
                profileLocalPath = imageResolver.getLocalFileUri(m.id);
              }
              return {
                id: m.id,
                displayName: m.display_name,
                profileImageId: m.profile_image_id || null,
                profileImageLocalPath: profileLocalPath,
                joinedAt: m.joined_at,
                isOwner: m.id === ownerId,
              };
            })
          )
        : [];

      return {
        id: groupId,
        name: groupName,
        ownerId,
        createdAt,
        members: membersList,
      };
    } catch (error) {
      console.error('[MemberRepository] Failed to get group info and members:', error);
      return null;
    }
  },

  /**
   * Atomic Update Member Profile:
   * Updates local SQLite member record immediately AND enqueues UPDATE_PROFILE item in sync_queue (Local-first).
   * Note: profile_image_id is strictly reserved for image UUIDs or NULL. Local URIs are registered with imageResolver.
   */
  async updateMemberProfileTransaction(
    memberId: string,
    displayName: string,
    profileLocalPath: string | null
  ): Promise<boolean> {
    const db = getDB();
    try {
      const nowIso = new Date().toISOString();
      const syncOpId = `op_${Date.now()}`;
      const payload = JSON.stringify({
        memberId,
        displayName,
        profileLocalPath,
        updatedAt: nowIso,
      });

      const batchStmts: Array<[string, any[]]> = [];

      if (profileLocalPath === null) {
        // Photo explicitly removed: fetch current imageId & storagePath to purge all cache keys
        const currentMember = await db.execute(
          `SELECT m.profile_image_id, img.storage_path FROM members m LEFT JOIN images img ON m.profile_image_id = img.id WHERE m.id = ? LIMIT 1;`,
          [memberId]
        );
        if (currentMember.rows && currentMember.rows.length > 0) {
          const mRow: any = currentMember.rows[0];
          imageResolver.removeLocalFileUri(memberId, mRow.profile_image_id, mRow.storage_path);
        } else {
          imageResolver.removeLocalFileUri(memberId);
        }
        batchStmts.push([
          `UPDATE members SET display_name = ?, profile_image_id = NULL WHERE id = ?;`,
          [displayName, memberId],
        ]);
      } else if (
        profileLocalPath &&
        (profileLocalPath.startsWith('file://') || profileLocalPath.startsWith('content://'))
      ) {
        // Register local URI with imageResolver for instant offline rendering,
        // but do not store filesystem path string in profile_image_id column.
        imageResolver.setLocalFileUri(memberId, profileLocalPath);
        batchStmts.push([
          `UPDATE members SET display_name = ? WHERE id = ?;`,
          [displayName, memberId],
        ]);
      } else {
        batchStmts.push([
          `UPDATE members SET display_name = ? WHERE id = ?;`,
          [displayName, memberId],
        ]);
      }

      batchStmts.push([
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at, retry_count)
         VALUES (?, 'member', ?, 'UPDATE_PROFILE', ?, ?, 0);`,
        [syncOpId, memberId, payload, nowIso],
      ]);

      await db.executeBatch(batchStmts);
      return true;
    } catch (error) {
      console.error('[MemberRepository] Failed to update member profile locally:', error);
      return false;
    }
  },
};

export default MemberRepository;
