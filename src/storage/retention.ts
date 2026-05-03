import type { DatabaseSync, SQLInputValue } from "node:sqlite"

type SQLiteRunResult = {
  readonly changes: number
  readonly lastInsertRowid: bigint | number
}

export interface RetentionPruneResult {
  readonly deletedNotifications: number
  readonly deletedRawPayloads: number
  readonly deletedReadStates: number
  readonly deletedThreads: number
}

/** Prunes age-limited records and removes dependent orphan rows in one transaction. */
export async function pruneStorageByRetention(
  db: DatabaseSync,
  cutoffIso: string,
): Promise<RetentionPruneResult> {
  db.exec("BEGIN")
  try {
    const result = runRetentionDeletes(db, cutoffIso)

    db.exec("COMMIT")
    await settleSynchronousTransaction()

    return result
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

function runRetentionDeletes(db: DatabaseSync, cutoffIso: string): RetentionPruneResult {
  return {
    deletedNotifications: deleteOldNotifications(db, cutoffIso),
    deletedRawPayloads: deleteOldRawPayloads(db, cutoffIso),
    deletedReadStates: deleteOrphanedReadStates(db),
    deletedThreads: deleteOldEmptyThreads(db, cutoffIso),
  }
}

function deleteOldNotifications(db: DatabaseSync, cutoffIso: string): number {
  return runWithChanges(db, "DELETE FROM local_notifications WHERE source_timestamp < ?", cutoffIso)
}

function deleteOrphanedReadStates(db: DatabaseSync): number {
  return runWithChanges(
    db,
    `
      DELETE FROM read_states
      WHERE notification_id NOT IN (SELECT id FROM local_notifications)
    `,
  )
}

function deleteOldEmptyThreads(db: DatabaseSync, cutoffIso: string): number {
  return runWithChanges(
    db,
    `
      DELETE FROM notification_threads
      WHERE source_updated_at < ?
        AND id NOT IN (SELECT thread_id FROM local_notifications)
    `,
    cutoffIso,
  )
}

function deleteOldRawPayloads(db: DatabaseSync, cutoffIso: string): number {
  return runWithChanges(db, "DELETE FROM raw_github_payloads WHERE fetched_at < ?", cutoffIso)
}

function runWithChanges(
  db: DatabaseSync,
  sql: string,
  ...parameters: readonly SQLInputValue[]
): number {
  const result = db.prepare(sql).run(...parameters) as SQLiteRunResult

  return result.changes
}

async function settleSynchronousTransaction(): Promise<void> {
  await Promise.resolve()
}
