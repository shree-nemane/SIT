import { open, DB } from '@op-engineering/op-sqlite';
import { CREATE_TABLES_SQL } from './schema';

let dbInstance: DB | null = null;

export const getDB = (): DB => {
  if (!dbInstance) {
    dbInstance = open({ name: 'stayintouch.sqlite' });
    for (const sql of CREATE_TABLES_SQL) {
      try {
        dbInstance.execute(sql);
      } catch {
        // Table already exists
      }
    }
  }
  return dbInstance;
};

export const initDatabase = async (): Promise<boolean> => {
  try {
    const db = getDB();
    for (const sql of CREATE_TABLES_SQL) {
      await db.execute(sql);
    }
    // console.log('[SQLite] Local database connection initialized successfully.');
    return true;
  } catch (error) {
    // console.error('[SQLite] Failed to initialize database:', error);
    return false;
  }
};

export default {
  getDB,
  initDatabase,
};
