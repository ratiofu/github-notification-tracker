import { TeamMembershipCacheEntrySchema, TeamMembershipCacheSchema } from "../domain/team-cache.js"
import type { DatabaseSync } from "node:sqlite"
import type { DeepReadonly } from "../domain/readonly.js"
import type { RepoName } from "../domain/shared.js"
import { parseJsonRow } from "./row-parsing.js"
import { settleSynchronousStatement } from "./db-util.js"

type TeamMembershipCache = DeepReadonly<ReturnType<typeof TeamMembershipCacheSchema.parse>>
type TeamMembershipCacheEntry = DeepReadonly<
  ReturnType<typeof TeamMembershipCacheEntrySchema.parse>
>

/** Caches team membership entries used to expand participant filters. */
export class TeamMembershipCacheRepository {
  readonly #db: DatabaseSync

  constructor(db: DatabaseSync) {
    this.#db = db
  }

  async upsert(repo: RepoName, entry: TeamMembershipCacheEntry): Promise<void> {
    const parsed = TeamMembershipCacheEntrySchema.parse(entry)

    this.#db
      .prepare(`
        INSERT INTO team_membership_cache_entries (
          repo,
          org,
          slug,
          expires_at,
          synced_at,
          payload_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(repo, org, slug) DO UPDATE SET
          expires_at = excluded.expires_at,
          synced_at = excluded.synced_at,
          payload_json = excluded.payload_json
      `)
      .run(
        repo,
        parsed.team.org,
        parsed.team.slug,
        parsed.expiresAt,
        parsed.syncedAt,
        JSON.stringify(parsed),
      )
    await settleSynchronousStatement()
  }

  async listByRepo(repo: RepoName): Promise<TeamMembershipCache> {
    const rows = this.#db
      .prepare(`
        SELECT payload_json
        FROM team_membership_cache_entries
        WHERE repo = ?
        ORDER BY org ASC, slug ASC
      `)
      .all(repo)
    await settleSynchronousStatement()

    return TeamMembershipCacheSchema.parse({
      entries: rows.map((row) => parseJsonRow(row, TeamMembershipCacheEntrySchema)),
      repo,
    })
  }
}
