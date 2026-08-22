import { getDB } from '../../database/db';
import { supabase } from '../../data/supabaseClient';
import SyncQueueRepository from '../../data/repositories/SyncQueueRepository';
import { generateUUID, isUUID } from '../../utils/uuid';
import imageResolver from '../media/imageResolver';


export const syncPush = {
  /**
   * Process pending items in local sync queue (Push: Local -> Cloud)
   */
  async processPendingQueue(userId: string): Promise<boolean> {
    const db = getDB();
    const pendingItems = await SyncQueueRepository.getPendingOperations();

    if (pendingItems.length === 0) {
      return true;
    }

    for (const item of pendingItems) {
      try {
        // Discard legacy broken items if retried more than 5 times
        if (item.retryCount > 5) {
          console.warn(`[SyncPush] Discarding unresolvable sync queue item: ${item.id}`);
          await db.execute('DELETE FROM sync_queue WHERE id = ?;', [item.id]);
          continue;
        }

        // Mark item as syncing
        await db.execute('UPDATE sync_queue SET last_error = NULL WHERE id = ?;', [item.id]);

        const payload = JSON.parse(item.payload);
        const validMemberId = isUUID(payload.memberId) ? payload.memberId : userId;

        // Handle Presence Deletion
        if (item.operation === 'DELETE') {
          console.log(`[SyncPush] Processing DELETE presence for member: ${validMemberId}`);

          // 1. Fetch remote presence image ID before deleting presence
          const { data: existingPresence } = await supabase
            .from('presences')
            .select('image_id')
            .eq('member_id', validMemberId)
            .maybeSingle();

          const oldImageId = existingPresence?.image_id;

          // 2. Delete presence record from Supabase
          const { error: delErr } = await supabase
            .from('presences')
            .delete()
            .eq('member_id', validMemberId);

          if (delErr) {
            throw new Error(`Delete presence failed: ${delErr.message}`);
          }

          // 3. Asynchronously cleanup old presence image metadata & storage object if present
          if (oldImageId) {
            try {
              const { data: imgRecord } = await supabase
                .from('images')
                .select('storage_path')
                .eq('id', oldImageId)
                .maybeSingle();

              if (imgRecord?.storage_path) {
                await supabase.from('images').delete().eq('id', oldImageId);
                await supabase.storage.from('presence-images').remove([imgRecord.storage_path]);
                console.log(`[SyncPush] Successfully cleaned up image: ${imgRecord.storage_path}`);
              }
            } catch (cleanupErr) {
              console.warn('[SyncPush] Image cleanup warning:', cleanupErr);
            }
          }

          await db.execute('DELETE FROM sync_queue WHERE id = ?;', [item.id]);
          console.log(`[SyncPush] Successfully synced presence deletion item: ${item.id}`);
          continue;
        }

        // Handle Profile Updates
        if (item.operation === 'UPDATE_PROFILE') {
          console.log(`[SyncPush] Processing UPDATE_PROFILE for member: ${validMemberId}`);
          let profileImageUuid: string | null = null;
          let uploadedStoragePath: string | null = null;
          let fileByteSize = 0;

          if (payload.profileLocalPath && payload.profileLocalPath.startsWith('file://')) {
            try {
              const fileName = `${userId}/profile/${Date.now()}.jpg`;
              const resp = await fetch(payload.profileLocalPath);
              const fileData = await resp.arrayBuffer();
              fileByteSize = fileData.byteLength || 0;

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('presence-images')
                .upload(fileName, fileData, {
                  contentType: 'image/jpeg',
                  upsert: true,
                });

              if (!uploadError && uploadData) {
                uploadedStoragePath = uploadData.path;
                const { data: imgData, error: imgErr } = await supabase
                  .from('images')
                  .insert({
                    storage_path: uploadData.path,
                    uploaded_by: userId,
                    width: 512,
                    height: 512,
                    file_size: fileByteSize,
                  })
                  .select('id')
                  .single();

                if (!imgErr && imgData) {
                  profileImageUuid = imgData.id;
                }
              }
            } catch (pErr) {
              console.warn('[SyncPush] Profile image upload warning:', pErr);
            }
          }

          const isProfileImageCleared = payload.profileLocalPath === null;
          const updateObj: any = { display_name: payload.displayName };

          if (profileImageUuid) {
            updateObj.profile_image_id = profileImageUuid;
          } else if (isProfileImageCleared) {
            updateObj.profile_image_id = null;
          }

          const { error: memberErr } = await supabase
            .from('members')
            .update(updateObj)
            .eq('id', validMemberId);

          if (memberErr) {
            throw new Error(`Update member profile failed: ${memberErr.message}`);
          }

          // Reconcile local uploader SQLite database state
          const batchStmts: Array<[string, any[]]> = [];
          const nowIso = new Date().toISOString();

          if (profileImageUuid && uploadedStoragePath) {
            batchStmts.push([
              `INSERT INTO images (id, storage_path, width, height, file_size, uploaded_at)
               VALUES (?, ?, 512, 512, ?, ?)
               ON CONFLICT(id) DO UPDATE SET storage_path = excluded.storage_path;`,
              [profileImageUuid, uploadedStoragePath, fileByteSize, nowIso],
            ]);
            batchStmts.push([
              `UPDATE members SET display_name = ?, profile_image_id = ? WHERE id = ?;`,
              [payload.displayName, profileImageUuid, validMemberId],
            ]);
            imageResolver.setLocalFileUri(profileImageUuid, payload.profileLocalPath);
            imageResolver.setLocalFileUri(uploadedStoragePath, payload.profileLocalPath);
          } else if (isProfileImageCleared) {
            batchStmts.push([
              `UPDATE members SET display_name = ?, profile_image_id = NULL WHERE id = ?;`,
              [payload.displayName, validMemberId],
            ]);
          } else {
            batchStmts.push([
              `UPDATE members SET display_name = ? WHERE id = ?;`,
              [payload.displayName, validMemberId],
            ]);
          }

          batchStmts.push(['DELETE FROM sync_queue WHERE id = ?;', [item.id]]);
          await db.executeBatch(batchStmts);

          console.log(`[SyncPush] Successfully synced profile update item: ${item.id}`);
          continue;
        }

        // Handle Presence Insert/Upsert
        const validPresenceId = isUUID(payload.presenceId) ? payload.presenceId : generateUUID();
        let imageUuid: string | null = null;
        let presenceStoragePath: string | null = null;
        let presenceFileSize = payload.imageFileSize || 0;

        if (payload.imageLocalPath && payload.imageLocalPath.startsWith('file://')) {
          try {
            const fileName = `${userId}/presence/${Date.now()}.jpg`;
            const resp = await fetch(payload.imageLocalPath);
            const fileData = await resp.arrayBuffer();
            presenceFileSize = fileData.byteLength || presenceFileSize;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('presence-images')
              .upload(fileName, fileData, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (!uploadError && uploadData) {
              presenceStoragePath = uploadData.path;
              const { data: imgData, error: imgErr } = await supabase
                .from('images')
                .insert({
                  storage_path: uploadData.path,
                  uploaded_by: userId,
                  width: payload.imageWidth || 0,
                  height: payload.imageHeight || 0,
                  file_size: presenceFileSize,
                })
                .select('id')
                .single();

              if (!imgErr && imgData) {
                imageUuid = imgData.id;
              }
            }
          } catch (imgError: any) {
            console.error('[SyncPush] Image upload exception:', imgError?.message || imgError);
          }
        }

        const nowIso = payload.updatedAt || new Date().toISOString();
        const { error: upsertError } = await supabase.from('presences').upsert(
          {
            id: validPresenceId,
            member_id: validMemberId,
            description: payload.description,
            image_id: imageUuid,
            updated_at: nowIso,
          },
          { onConflict: 'member_id' }
        );

        if (upsertError) {
          throw new Error(upsertError.message);
        }

        const batchStmts: Array<[string, any[]]> = [];
        if (imageUuid && presenceStoragePath) {
          batchStmts.push([
            `INSERT INTO images (id, storage_path, width, height, file_size, uploaded_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET storage_path = excluded.storage_path;`,
            [
              imageUuid,
              presenceStoragePath,
              payload.imageWidth || 0,
              payload.imageHeight || 0,
              presenceFileSize,
              nowIso,
            ],
          ]);
          imageResolver.setLocalFileUri(imageUuid, payload.imageLocalPath);
          imageResolver.setLocalFileUri(presenceStoragePath, payload.imageLocalPath);
        }

        const isImageCleared = payload.imageLocalPath === null;
        if (imageUuid) {
          batchStmts.push([
            "UPDATE presences SET sync_status = 'synced', id = ?, image_id = ? WHERE member_id = ?;",
            [validPresenceId, imageUuid, validMemberId],
          ]);
        } else if (isImageCleared) {
          batchStmts.push([
            "UPDATE presences SET sync_status = 'synced', id = ?, image_id = NULL WHERE member_id = ?;",
            [validPresenceId, validMemberId],
          ]);
        } else {
          batchStmts.push([
            "UPDATE presences SET sync_status = 'synced', id = ? WHERE member_id = ?;",
            [validPresenceId, validMemberId],
          ]);
        }
        batchStmts.push(['DELETE FROM sync_queue WHERE id = ?;', [item.id]]);

        await db.executeBatch(batchStmts);

        console.log(`[SyncPush] Successfully synced presence item: ${item.id}`);
      } catch (err: any) {
        console.error(`[SyncPush] Error processing item ${item.id}:`, err);
        const retryCount = item.retryCount + 1;
        const errorMsg = err.message || 'Push sync failed';

        await db.execute(
          'UPDATE sync_queue SET retry_count = ?, last_error = ? WHERE id = ?;',
          [retryCount, errorMsg, item.id]
        );
      }
    }

    return true;
  },
};

export default syncPush;
