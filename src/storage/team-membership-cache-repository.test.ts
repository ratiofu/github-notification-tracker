import { afterEach, describe, expect, it } from "vitest"

import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js"
import type { TeamMembershipCacheEntry } from "../domain/team-cache.js"
import { TeamMembershipCacheRepository } from "./team-membership-cache-repository.js"
import { createTeamEntryFixture } from "../domain/fixtures.js"

const REPO = "acme/widgets"

describe("team membership cache repository", () => {
  afterEach(() => {
    cleanupTempStorage()
  })

  it("round trips team cache entries by repo", roundTripsTeamCacheEntriesByRepo)
  it("updates an existing team cache entry through upsert", updatesExistingTeamCacheEntry)
  it("returns an empty team cache for repos without cached teams", returnsEmptyCacheForUnknownRepo)
  it("parses persisted JSON through the team cache schema on read", parsesPersistedJsonOnRead)
})

async function roundTripsTeamCacheEntriesByRepo(): Promise<void> {
  const storage = createTempStorage()
  const repository = new TeamMembershipCacheRepository(storage.db)
  const teamEntry = createTeamEntryFixture()

  await repository.upsert(REPO, teamEntry)

  await expect(repository.listByRepo(REPO)).resolves.toStrictEqual({
    entries: [teamEntry],
    repo: REPO,
  })
  await storage.close()
}

async function updatesExistingTeamCacheEntry(): Promise<void> {
  const storage = createTempStorage()
  const repository = new TeamMembershipCacheRepository(storage.db)
  const updatedTeamEntry = createUpdatedTeamEntry()

  await repository.upsert(REPO, createTeamEntryFixture())
  await repository.upsert(REPO, updatedTeamEntry)

  await expect(repository.listByRepo(REPO)).resolves.toStrictEqual({
    entries: [updatedTeamEntry],
    repo: REPO,
  })
  await storage.close()
}

async function returnsEmptyCacheForUnknownRepo(): Promise<void> {
  const storage = createTempStorage()

  await expect(
    new TeamMembershipCacheRepository(storage.db).listByRepo(REPO),
  ).resolves.toStrictEqual({
    entries: [],
    repo: REPO,
  })
  await storage.close()
}

async function parsesPersistedJsonOnRead(): Promise<void> {
  const storage = createTempStorage()
  const repository = new TeamMembershipCacheRepository(storage.db)

  await repository.upsert(REPO, createTeamEntryFixture())
  storage.db
    .prepare("UPDATE team_membership_cache_entries SET payload_json = ? WHERE repo = ?")
    .run(JSON.stringify({ team: { org: "acme", slug: "platform" } }), REPO)

  await expect(repository.listByRepo(REPO)).rejects.toThrow("Invalid input")
  await storage.close()
}

function createUpdatedTeamEntry(): TeamMembershipCacheEntry {
  const teamEntry = createTeamEntryFixture()

  return {
    ...teamEntry,
    members: ["tj"],
    syncedAt: "2026-05-01T00:15:00.000Z",
    team: {
      ...teamEntry.team,
      members: ["tj"],
    },
  }
}
