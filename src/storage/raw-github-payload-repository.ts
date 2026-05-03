import type { DatabaseSync } from "node:sqlite"

import type { DeepReadonly } from "../domain/readonly.js"
import { RawGitHubPayloadSchema } from "../domain/shared.js"
import { parseOptionalJsonRow } from "./row-parsing.js"
import { settleSynchronousStatement } from "./db-util.js"

type RawGitHubPayload = DeepReadonly<ReturnType<typeof RawGitHubPayloadSchema.parse>>

/** Stores raw GitHub payloads by the storage keys referenced from generated notifications. */
export class RawGitHubPayloadRepository {
  readonly #db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.#db = db
  }

  async upsert(storageKey: string, payload: RawGitHubPayload): Promise<void> {
    const parsed = RawGitHubPayloadSchema.parse(payload)
    this.#db
      .prepare(`
        INSERT INTO raw_github_payloads (storage_key, source_id, fetched_at, payload_json)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(storage_key) DO UPDATE SET
          source_id = excluded.source_id,
          fetched_at = excluded.fetched_at,
          payload_json = excluded.payload_json
      `)
      .run(storageKey, parsed.id, parsed.fetchedAt, JSON.stringify(parsed))
    await settleSynchronousStatement()
  }

  async getByStorageKey(storageKey: string): Promise<RawGitHubPayload | undefined> {
    const row = this.#db
      .prepare("SELECT payload_json FROM raw_github_payloads WHERE storage_key = ?")
      .get(storageKey)
    await settleSynchronousStatement()

    return parseOptionalJsonRow(row, RawGitHubPayloadSchema)
  }
}
