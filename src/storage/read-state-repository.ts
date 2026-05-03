import { SQLITE_FALSE, SQLITE_TRUE } from "../constants.js"
import { readInteger, readNullableString, readString } from "./row-parsing.js"
import type { DatabaseSync } from "node:sqlite"
import type { DeepReadonly } from "../domain/readonly.js"
import type { LocalNotificationId } from "../domain/shared.js"
import { ReadStateSchema } from "../domain/read-state.js"
import { settleSynchronousStatement } from "./db-util.js"

type ReadState = DeepReadonly<ReturnType<typeof ReadStateSchema.parse>>

/** Keeps read state independently addressable for future TUI toggle writes. */
export class ReadStateRepository {
  readonly #db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.#db = db
  }

  async set(readState: ReadState): Promise<void> {
    const parsed = ReadStateSchema.parse(readState)
    this.#db
      .prepare(`
        INSERT INTO read_states (notification_id, is_read, read_at)
        VALUES (?, ?, ?)
        ON CONFLICT(notification_id) DO UPDATE SET
          is_read = excluded.is_read,
          read_at = excluded.read_at
      `)
      .run(parsed.notificationId, parsed.isRead ? SQLITE_TRUE : SQLITE_FALSE, parsed.readAt)
    await settleSynchronousStatement()
  }

  async get(notificationId: LocalNotificationId): Promise<ReadState | undefined> {
    const row = this.#db
      .prepare(`
        SELECT notification_id, is_read, read_at
        FROM read_states
        WHERE notification_id = ?
      `)
      .get(notificationId)
    await settleSynchronousStatement()

    if (row === undefined) {
      return undefined
    }

    return ReadStateSchema.parse({
      isRead: readInteger(row, "is_read") === SQLITE_TRUE,
      notificationId: readString(row, "notification_id"),
      readAt: readNullableString(row, "read_at"),
    })
  }
}
