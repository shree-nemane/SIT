import { NativeModules, Platform } from 'react-native';
import { getDB } from '../../database/db';
import { supabase } from '../../data/supabaseClient';
import widgetSnapshotService from '../widget/widgetSnapshot';
import imageResolver from '../media/imageResolver';

const { WidgetBridge } = NativeModules;

export const syncPull = {
  /**
   * Pull remote changes for group, members, presences, and images (Cloud -> Local SQLite)
   */
  async pullRemoteChanges(
    groupId: string,
    shouldContinueSync?: () => boolean | Promise<boolean>
  ): Promise<boolean> {
    const canContinue = async (): Promise<boolean> => {
      if (!shouldContinueSync) return true;
      try {
        return await shouldContinueSync();
      } catch {
        return false;
      }
    };

    if (!(await canContinue())) {
      return false;
    }

    const db = getDB();
    try {
      // 1. Fetch authoritative group record from Supabase
      const { data: remoteGroup, error: groupErr } = await supabase
        .from('groups')
        .select('id, name, owner_id, created_at')
        .eq('id', groupId)
        .maybeSingle();

      if (groupErr || !remoteGroup) {
        // console.error('[SyncPull] Error fetching remote group:', groupErr);
        return false;
      }

      if (!(await canContinue())) {
        return false;
      }

      // 2. Fetch all remote members belonging to the group
      const { data: remoteMembers, error: membersErr } = await supabase
        .from('members')
        .select('id, group_id, display_name, profile_image_id, joined_at, created_at')
        .eq('group_id', groupId);

      if (membersErr || !remoteMembers) {
        // console.error('[SyncPull] Error fetching remote members:', membersErr);
        return false;
      }

      const memberIds = remoteMembers.map((m) => m.id);

      // 3. Fetch all remote presences belonging to group members via .in('member_id', memberIds)
      let remotePresences: any[] = [];
      if (memberIds.length > 0) {
        const { data: presencesData, error: presencesErr } = await supabase
          .from('presences')
          .select('id, member_id, description, image_id, updated_at')
          .in('member_id', memberIds);

        if (presencesErr) {
          // console.error('[SyncPull] Error fetching remote presences:', presencesErr);
          return false;
        }
        remotePresences = presencesData || [];
      }

      // 4. Fetch relevant image metadata records for members and presences
      const imageIdsToFetch = new Set<string>();
      for (const m of remoteMembers) {
        if (m.profile_image_id) imageIdsToFetch.add(m.profile_image_id);
      }
      for (const p of remotePresences) {
        if (p.image_id) imageIdsToFetch.add(p.image_id);
      }

      let remoteImages: any[] = [];
      if (imageIdsToFetch.size > 0) {
        const { data: imagesData, error: imagesErr } = await supabase
          .from('images')
          .select('id, storage_path, width, height, file_size, uploaded_at')
          .in('id', Array.from(imageIdsToFetch));

        if (imagesErr) {
          // console.error('[SyncPull] Error fetching remote images metadata:', imagesErr);
          return false;
        }
        remoteImages = imagesData || [];
      }

      if (!(await canContinue())) {
        return false;
      }

      // Media Downloader Pipeline (Sync Engine layer exclusively downloads media to persistent local disk)
      if (remoteImages.length > 0) {
        await Promise.all(
          remoteImages.map(async (img) => {
            if (img.storage_path) {
              try {
                // Check if local disk file already exists
                if (Platform.OS === 'android' && WidgetBridge && WidgetBridge.getLocalMediaFile) {
                  const existingFile = await WidgetBridge.getLocalMediaFile(img.storage_path);
                  if (existingFile) {
                    imageResolver.setLocalFileUri(img.storage_path, existingFile);
                    if (img.id) imageResolver.setLocalFileUri(img.id, existingFile);
                    return;
                  }
                }

                // If missing from local disk, download via temporary signed URL to persistent internal storage
                const { data: signedData } = await supabase.storage
                  .from('presence-images')
                  .createSignedUrl(img.storage_path, 86400);

                if (
                  signedData?.signedUrl &&
                  Platform.OS === 'android' &&
                  WidgetBridge &&
                  WidgetBridge.downloadAndCacheMedia
                ) {
                  const localFileUri = await WidgetBridge.downloadAndCacheMedia(
                    img.storage_path,
                    signedData.signedUrl
                  );
                  if (localFileUri) {
                    imageResolver.setLocalFileUri(img.storage_path, localFileUri);
                    if (img.id) imageResolver.setLocalFileUri(img.id, localFileUri);
                  }
                }
              } catch (sErr) {
                // console.warn('[SyncPull] Warning downloading media file for:', img.storage_path, sErr);
              }
            }
          })
        );
      }

      if (!(await canContinue())) {
        return false;
      }

      const batchStatements: Array<[string, any[]]> = [];

      // A. Group UPSERT statement
      batchStatements.push([
        `INSERT INTO groups (id, name, owner_id, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           owner_id = excluded.owner_id,
           created_at = excluded.created_at;`,
        [remoteGroup.id, remoteGroup.name, remoteGroup.owner_id, remoteGroup.created_at],
      ]);

      // B. Images metadata UPSERT statements (Durable SQLite state stores ONLY permanent image metadata UUIDs & storage_path, NEVER temporary signed URLs)
      for (const img of remoteImages) {
        batchStatements.push([
          `INSERT INTO images (id, storage_path, width, height, file_size, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             storage_path = excluded.storage_path,
             width = excluded.width,
             height = excluded.height,
             file_size = excluded.file_size,
             uploaded_at = excluded.uploaded_at;`,
          [
            img.id,
            img.storage_path,
            img.width || 0,
            img.height || 0,
            img.file_size || 0,
            img.uploaded_at || new Date().toISOString(),
          ],
        ]);
      }

      // C. Members UPSERT statements (profile_image_id set directly to remote UUID or NULL for authoritative removal)
      for (const m of remoteMembers) {
        batchStatements.push([
          `INSERT INTO members (id, group_id, display_name, profile_image_id, joined_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             group_id = excluded.group_id,
             display_name = excluded.display_name,
             profile_image_id = excluded.profile_image_id,
             joined_at = excluded.joined_at;`,
          [m.id, m.group_id, m.display_name, m.profile_image_id, m.joined_at, m.created_at],
        ]);
      }

      // D. Presences UPSERT statements (image_id set directly to remote UUID or NULL)
      for (const p of remotePresences) {
        batchStatements.push([
          `INSERT INTO presences (id, member_id, description, image_id, updated_at, sync_status)
           VALUES (?, ?, ?, ?, ?, 'synced')
           ON CONFLICT(member_id) DO UPDATE SET
             id = excluded.id,
             description = excluded.description,
             image_id = excluded.image_id,
             updated_at = excluded.updated_at,
             sync_status = 'synced';`,
          [p.id, p.member_id, p.description, p.image_id, p.updated_at],
        ]);
      }

      // E. Deletion Reconciliation (Only performed after trusted 100% remote query success)
      const remoteMemberIdSet = new Set(memberIds);
      const localMembersRes = await db.execute(
        'SELECT id FROM members WHERE group_id = ?;',
        [groupId]
      );

      if (localMembersRes.rows) {
        Array.from(localMembersRes.rows).forEach((row: any) => {
          if (!remoteMemberIdSet.has(row.id)) {
            batchStatements.push(['DELETE FROM members WHERE id = ?;', [row.id]]);
          }
        });
      }

      const activePresenceMemberIdSet = new Set(remotePresences.map((p) => p.member_id));
      const localPresencesRes = await db.execute(
        `SELECT p.member_id FROM presences p JOIN members m ON p.member_id = m.id WHERE m.group_id = ?;`,
        [groupId]
      );

      if (localPresencesRes.rows) {
        Array.from(localPresencesRes.rows).forEach((row: any) => {
          if (!activePresenceMemberIdSet.has(row.member_id)) {
            batchStatements.push(['DELETE FROM presences WHERE member_id = ?;', [row.member_id]]);
          }
        });
      }

      // F. Update sync cursor
      const newSyncTimestamp = new Date().toISOString();
      batchStatements.push([
        `INSERT INTO sync_metadata (key, value, updated_at)
         VALUES ('last_sync_timestamp', ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at;`,
        [newSyncTimestamp, newSyncTimestamp],
      ]);

      // Re-verify live membership status right before committing group-scoped SQLite transaction
      if (!(await canContinue())) {
        if (__DEV__) {
          console.log('[SyncPull] Membership/Auth status invalid during sync pull. Discarding group updates.');
        }
        return false;
      }

      // 5. Execute atomic SQLite transaction
      if (batchStatements.length > 0) {
        await db.executeBatch(batchStatements);
        // console.log(`[SyncPull] Atomic transaction applied ${batchStatements.length} statements to local database.`);
      }

      if (!(await canContinue())) {
        return false;
      }

      // 6. Update single widget snapshot projection & issue notification once per sync batch
      await widgetSnapshotService.updateAndNotifyWidget();
      return true;
    } catch (error) {
      // console.error('[SyncPull] Reconciliation error:', error);
      return false;
    }
  },
};

export default syncPull;
