/**
 * Stay in Touch Database Schema Definition
 * Engine: @op-engineering/op-sqlite
 * Tables: groups, members, presences, images, sync_queue, sync_metadata
 */

export const CREATE_TABLES_SQL = [
  // groups table
  `CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  // members table
  `CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY NOT NULL,
    group_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    profile_image_id TEXT,
    joined_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
  );`,

  // presences table (pluralized per schema spec: ADR-008, ADR-020)
  `CREATE TABLE IF NOT EXISTS presences (
    id TEXT PRIMARY KEY NOT NULL,
    member_id TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    image_id TEXT,
    updated_at TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'synced',
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
  );`,

  // images table
  `CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY NOT NULL,
    storage_path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at TEXT
  );`,

  // sync_queue table
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );`,

  // sync_metadata table
  `CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
];
