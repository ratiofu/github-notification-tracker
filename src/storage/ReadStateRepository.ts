import type { DatabaseSync } from "node:sqlite";

import { ReadStateSchema } from "../domain/index.js";
import type { LocalNotificationId, ReadState } from "../domain/index.js";
import { readInteger, readNullableString, readString } from "./row-parsing.js";

/** Keeps read state independently addressable for future TUI toggle writes. */
export class ReadStateRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  async set(readState: ReadState): Promise<void> {
    const parsed = ReadStateSchema.parse(readState);
    this.#db
      .prepare(`
        INSERT INTO read_states (notification_id, is_read, read_at)
        VALUES (?, ?, ?)
        ON CONFLICT(notification_id) DO UPDATE SET
          is_read = excluded.is_read,
          read_at = excluded.read_at
      `)
      .run(parsed.notificationId, parsed.isRead ? 1 : 0, parsed.readAt);
  }

  async get(notificationId: LocalNotificationId): Promise<ReadState | undefined> {
    const row = this.#db
      .prepare(`
        SELECT notification_id, is_read, read_at
        FROM read_states
        WHERE notification_id = ?
      `)
      .get(notificationId);

    if (row === undefined) {
      return undefined;
    }

    return ReadStateSchema.parse({
      isRead: readInteger(row, "is_read") === 1,
      notificationId: readString(row, "notification_id"),
      readAt: readNullableString(row, "read_at"),
    });
  }
}
