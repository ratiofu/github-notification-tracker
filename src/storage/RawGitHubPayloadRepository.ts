import type { DatabaseSync } from "node:sqlite";

import { RawGitHubPayloadSchema } from "../domain/index.js";
import type { RawGitHubPayload } from "../domain/index.js";
import { parseOptionalJsonRow } from "./row-parsing.js";

/** Stores raw GitHub payloads by the storage keys referenced from generated notifications. */
export class RawGitHubPayloadRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  async upsert(storageKey: string, payload: RawGitHubPayload): Promise<void> {
    const parsed = RawGitHubPayloadSchema.parse(payload);
    this.#db
      .prepare(`
        INSERT INTO raw_github_payloads (storage_key, source_id, fetched_at, payload_json)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(storage_key) DO UPDATE SET
          source_id = excluded.source_id,
          fetched_at = excluded.fetched_at,
          payload_json = excluded.payload_json
      `)
      .run(storageKey, parsed.id, parsed.fetchedAt, JSON.stringify(parsed));
  }

  async getByStorageKey(storageKey: string): Promise<RawGitHubPayload | undefined> {
    const row = this.#db
      .prepare("SELECT payload_json FROM raw_github_payloads WHERE storage_key = ?")
      .get(storageKey);

    return parseOptionalJsonRow(row, RawGitHubPayloadSchema);
  }
}
