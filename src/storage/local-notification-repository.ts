import type { LocalNotificationId, NotificationThreadId } from "../domain/shared.js"
import { SQLITE_FALSE, SQLITE_TRUE } from "../constants.js"
import { parseJsonRow, parseOptionalJsonRow } from "./row-parsing.js"
import type { DatabaseSync } from "node:sqlite"
import type { DeepReadonly } from "../domain/readonly.js"
import { LocalNotificationSchema } from "../domain/notification.js"
import { settleSynchronousStatement } from "./db-util.js"

type LocalNotification = DeepReadonly<ReturnType<typeof LocalNotificationSchema.parse>>

const LOCAL_NOTIFICATION_UPSERT_SQL = `
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
`

interface LocalNotificationRowValues {
  readonly createdAt: string
  readonly id: LocalNotificationId
  readonly isRead: number
  readonly payloadJson: string
  readonly readAt: string | null
  readonly sourceFingerprint: string
  readonly sourceTimestamp: string
  readonly threadId: NotificationThreadId
  readonly type: LocalNotification["type"]
}

/** Stores generated notifications while preserving indexed fields for lookup and pruning. */
export class LocalNotificationRepository {
  readonly #db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.#db = db
  }

  async upsert(notification: LocalNotification): Promise<void> {
    const parsed = LocalNotificationSchema.parse(notification)
    const row = toRowValues(parsed)

    this.#db
      .prepare(LOCAL_NOTIFICATION_UPSERT_SQL)
      .run(
        row.id,
        row.threadId,
        row.sourceFingerprint,
        row.type,
        row.sourceTimestamp,
        row.createdAt,
        row.isRead,
        row.readAt,
        row.payloadJson,
      )
    await settleSynchronousStatement()
  }

  async getById(id: LocalNotificationId): Promise<LocalNotification | undefined> {
    const row = this.#db
      .prepare("SELECT payload_json FROM local_notifications WHERE id = ?")
      .get(id)
    await settleSynchronousStatement()

    return parseOptionalJsonRow(row, LocalNotificationSchema)
  }

  async listByThreadId(threadId: NotificationThreadId): Promise<readonly LocalNotification[]> {
    const rows = this.#db
      .prepare(`
        SELECT payload_json
        FROM local_notifications
        WHERE thread_id = ?
        ORDER BY source_timestamp DESC, id ASC
      `)
      .all(threadId)
    await settleSynchronousStatement()

    return rows.map((row) => parseJsonRow(row, LocalNotificationSchema))
  }
}

function toRowValues(notification: LocalNotification): LocalNotificationRowValues {
  return {
    createdAt: notification.createdAt,
    id: notification.id,
    isRead: notification.isRead ? SQLITE_TRUE : SQLITE_FALSE,
    payloadJson: JSON.stringify(notification),
    readAt: notification.readAt,
    sourceFingerprint: notification.sourceFingerprint,
    sourceTimestamp: notification.sourceTimestamp,
    threadId: notification.threadId,
    type: notification.type,
  }
}
