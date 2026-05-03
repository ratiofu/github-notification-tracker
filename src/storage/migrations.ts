import type { DatabaseSync } from "node:sqlite"

const INITIAL_SCHEMA_VERSION = 1

const migrations = [
  {
    sql: `
      CREATE TABLE IF NOT EXISTS notification_threads (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        repo TEXT NOT NULL,
        source_updated_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS local_notifications (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES notification_threads(id) ON DELETE CASCADE,
        source_fingerprint TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        source_timestamp TEXT NOT NULL,
        created_at TEXT NOT NULL,
        is_read INTEGER NOT NULL CHECK (is_read IN (0, 1)),
        read_at TEXT,
        payload_json TEXT NOT NULL
      ) STRICT;

      CREATE INDEX IF NOT EXISTS local_notifications_thread_source_idx
        ON local_notifications (thread_id, source_timestamp DESC);

      CREATE TABLE IF NOT EXISTS read_states (
        notification_id TEXT PRIMARY KEY REFERENCES local_notifications(id) ON DELETE CASCADE,
        is_read INTEGER NOT NULL CHECK (is_read IN (0, 1)),
        read_at TEXT
      ) STRICT;

      CREATE TABLE IF NOT EXISTS raw_github_payloads (
        storage_key TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        payload_json TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS team_membership_cache_entries (
        repo TEXT NOT NULL,
        org TEXT NOT NULL,
        slug TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        synced_at TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (repo, org, slug)
      ) STRICT;
    `,
    version: INITIAL_SCHEMA_VERSION,
  },
] as const

/** Applies ordered schema migrations and records each completed version. */
export function migrateDatabase(db: DatabaseSync, appliedAt = new Date().toISOString()): void {
  ensureMigrationTable(db)

  const appliedVersions = readAppliedVersions(db)

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      applyMigration(db, migration, appliedAt)
    }
  }
}

function ensureMigrationTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `)
}

function readAppliedVersions(db: DatabaseSync): ReadonlySet<number> {
  const versions = db
    .prepare("SELECT version FROM schema_migrations")
    .all()
    .map((row) => readNumber(row, "version"))

  return new Set(versions)
}

function applyMigration(
  db: DatabaseSync,
  migration: (typeof migrations)[number],
  appliedAt: string,
): void {
  db.exec("BEGIN")
  try {
    db.exec(migration.sql)
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
      migration.version,
      appliedAt,
    )
    db.exec("COMMIT")
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

function readNumber(row: unknown, key: string): number {
  if (typeof row !== "object" || row === null || !(key in row)) {
    throw new Error(`SQLite row is missing ${key}`)
  }

  const value = row[key as keyof typeof row]
  if (typeof value !== "number") {
    throw new TypeError(`SQLite row ${key} is not a number`)
  }

  return value
}
