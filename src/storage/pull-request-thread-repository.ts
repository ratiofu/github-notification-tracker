import type { NotificationThreadId, RepoName } from "../domain/shared.js"
import { parseJsonRow, parseOptionalJsonRow } from "./row-parsing.js"
import type { DatabaseSync } from "node:sqlite"
import type { DeepReadonly } from "../domain/readonly.js"
import { PullRequestThreadSchema } from "../domain/notification-thread.js"
import { settleSynchronousStatement } from "./db-util.js"

type PullRequestThread = DeepReadonly<ReturnType<typeof PullRequestThreadSchema.parse>>

/** Persists PR thread boundary records and leaves child notification storage separate. */
export class PullRequestThreadRepository {
  readonly #db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.#db = db
  }

  async upsert(thread: PullRequestThread): Promise<void> {
    const parsed = PullRequestThreadSchema.parse(thread)
    this.#db
      .prepare(`
        INSERT INTO notification_threads (id, kind, repo, source_updated_at, payload_json)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          kind = excluded.kind,
          repo = excluded.repo,
          source_updated_at = excluded.source_updated_at,
          payload_json = excluded.payload_json
      `)
      .run(
        parsed.thread.id,
        parsed.thread.kind,
        parsed.thread.repo,
        parsed.thread.sourceUpdatedAt,
        JSON.stringify(parsed),
      )
    await settleSynchronousStatement()
  }

  async getById(threadId: NotificationThreadId): Promise<PullRequestThread | undefined> {
    const row = this.#db
      .prepare("SELECT payload_json FROM notification_threads WHERE id = ?")
      .get(threadId)
    await settleSynchronousStatement()

    return parseOptionalJsonRow(row, PullRequestThreadSchema)
  }

  async listByRepo(repo: RepoName): Promise<readonly PullRequestThread[]> {
    const rows = this.#db
      .prepare(`
        SELECT payload_json
        FROM notification_threads
        WHERE repo = ?
        ORDER BY source_updated_at DESC, id ASC
      `)
      .all(repo)
    await settleSynchronousStatement()

    return rows.map((row) => parseJsonRow(row, PullRequestThreadSchema))
  }
}
