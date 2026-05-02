import type { DatabaseSync } from "node:sqlite";

import { LocalNotificationSchema } from "../domain/index.js";
import type {
  LocalNotification,
  LocalNotificationId,
  NotificationThreadId,
} from "../domain/index.js";
import { parseJsonRow, parseOptionalJsonRow } from "./row-parsing.js";

/** Stores generated notifications while preserving indexed fields for lookup and pruning. */
export class LocalNotificationRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  async upsert(notification: LocalNotification): Promise<void> {
    const parsed = LocalNotificationSchema.parse(notification);
    this.#db
      .prepare(`
        INSERT INTO local_notifications (
          id,
          thread_id,
          source_fingerprint,
          type,
          source_timestamp,
          created_at,
          is_read,
          read_at,
          payload_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_fingerprint) DO UPDATE SET
          created_at = excluded.created_at,
          is_read = excluded.is_read,
          payload_json = json_set(excluded.payload_json, '$.id', local_notifications.id),
          read_at = excluded.read_at,
          thread_id = excluded.thread_id,
          type = excluded.type,
          source_timestamp = excluded.source_timestamp
      `)
      .run(
        parsed.id,
        parsed.threadId,
        parsed.sourceFingerprint,
        parsed.type,
        parsed.sourceTimestamp,
        parsed.createdAt,
        parsed.isRead ? 1 : 0,
        parsed.readAt,
        JSON.stringify(parsed),
      );
  }

  async getById(id: LocalNotificationId): Promise<LocalNotification | undefined> {
    const row = this.#db
      .prepare("SELECT payload_json FROM local_notifications WHERE id = ?")
      .get(id);

    return parseOptionalJsonRow(row, LocalNotificationSchema);
  }

  async listByThreadId(threadId: NotificationThreadId): Promise<readonly LocalNotification[]> {
    const rows = this.#db
      .prepare(`
        SELECT payload_json
        FROM local_notifications
        WHERE thread_id = ?
        ORDER BY source_timestamp DESC, id ASC
      `)
      .all(threadId);

    return rows.map((row) => parseJsonRow(row, LocalNotificationSchema));
  }
}
