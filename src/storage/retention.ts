import type { DatabaseSync, SQLInputValue } from "node:sqlite";

type SQLiteRunResult = {
  readonly changes: number;
  readonly lastInsertRowid: bigint | number;
};

export interface RetentionPruneResult {
  readonly deletedNotifications: number;
  readonly deletedRawPayloads: number;
  readonly deletedReadStates: number;
  readonly deletedThreads: number;
}

/** Prunes age-limited records and removes dependent orphan rows in one transaction. */
export async function pruneStorageByRetention(
  db: DatabaseSync,
  cutoffIso: string,
): Promise<RetentionPruneResult> {
  db.exec("BEGIN");
  try {
    const deletedNotifications = runWithChanges(
      db,
      "DELETE FROM local_notifications WHERE source_timestamp < ?",
      cutoffIso,
    );
    const deletedReadStates = runWithChanges(
      db,
      `
        DELETE FROM read_states
        WHERE notification_id NOT IN (SELECT id FROM local_notifications)
      `,
    );
    const deletedThreads = runWithChanges(
      db,
      `
        DELETE FROM notification_threads
        WHERE source_updated_at < ?
          AND id NOT IN (SELECT thread_id FROM local_notifications)
      `,
      cutoffIso,
    );
    const deletedRawPayloads = runWithChanges(
      db,
      "DELETE FROM raw_github_payloads WHERE fetched_at < ?",
      cutoffIso,
    );

    db.exec("COMMIT");

    return {
      deletedNotifications,
      deletedRawPayloads,
      deletedReadStates,
      deletedThreads,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function runWithChanges(
  db: DatabaseSync,
  sql: string,
  ...parameters: readonly SQLInputValue[]
): number {
  const result = db.prepare(sql).run(...parameters) as SQLiteRunResult;

  return result.changes;
}
