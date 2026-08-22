import { getDB } from '../../database/db';

export interface PendingSyncItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: string;
  createdAt: string;
  retryCount: number;
  lastError: string | null;
}

export const SyncQueueRepository = {
  /**
   * Get all pending operations stored in local sync queue
   */
  async getPendingOperations(): Promise<PendingSyncItem[]> {
    const db = getDB();
    try {
      const res = await db.execute(
        'SELECT id, entity_type, entity_id, operation, payload, created_at, retry_count, last_error FROM sync_queue ORDER BY created_at ASC;'
      );
      if (!res.rows) return [];
      return Array.from(res.rows).map((row: any) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        operation: row.operation,
        payload: row.payload,
        createdAt: row.created_at,
        retryCount: row.retry_count,
        lastError: row.last_error,
      }));
    } catch (error) {
      console.error('[SyncQueueRepository] Failed to fetch sync queue items:', error);
      return [];
    }
  },
};

export default SyncQueueRepository;
