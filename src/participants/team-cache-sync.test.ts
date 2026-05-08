import type { TeamMembershipCache, TeamMembershipCacheEntry } from "../domain/team-cache.js"
import { describe, expect, it } from "vitest"
import type { GitHubGenericSourceFetchResult } from "../github/source-types.js"
import type { GitHubSourcePayloadWrapper } from "../domain/github-source.js"
import type { LogInput } from "../logger/types.js"
import type { RepoName } from "../domain/shared.js"
import { TeamCacheSync } from "./team-cache-sync.js"
import { createTeamEntryFixture } from "../domain/fixtures.js"

const FETCHED_AT = "2026-05-01T00:00:00.000Z"
const HTTP_STATUS_OK = 200
const REPO = "acme/widgets"
const SYNCED_AT = "2026-05-01T00:00:00.000Z"
const SYNC_INTERVAL_SECONDS = 3600
const TEAM_ENTITY_ID = 123
const TEAM_MEMBER_ENTITY_ID = 456

describe("team cache sync", () => {
  it("refreshes repository teams and members into the cache", refreshesTeamCache)
  it("returns cached team data and logs when sync fails", returnsCachedTeamDataOnFailure)
})

async function refreshesTeamCache() {
  const repository = createRepository()
  const logger = createLogger()
  const sync = new TeamCacheSync({
    fetcher: createFetcher(),
    logger,
    now: () => new Date(SYNCED_AT),
    repository,
    syncIntervalSeconds: SYNC_INTERVAL_SECONDS,
  })

  const result = await sync.sync(REPO)

  expect(repository.entries).toStrictEqual([createExpectedEntry()])
  expect(result).toStrictEqual({ entries: repository.entries, repo: REPO })
  expect(logger.events).toStrictEqual([])
}

async function returnsCachedTeamDataOnFailure() {
  const repository = createRepository([createTeamEntryFixture()])
  const logger = createLogger()
  const sync = new TeamCacheSync({
    fetcher: createFailingFetcher(),
    logger,
    now: () => new Date(SYNCED_AT),
    repository,
    syncIntervalSeconds: SYNC_INTERVAL_SECONDS,
  })

  await expect(sync.sync(REPO)).resolves.toStrictEqual({
    entries: [createTeamEntryFixture()],
    repo: REPO,
  })
  expect(logger.events).toStrictEqual([
    {
      data: { error: "rate limited", repo: REPO },
      event: "team_sync_failed",
      level: "warn",
      message: "Team sync failed for acme/widgets; using cached team membership data.",
    },
  ])
}

function createFetcher() {
  return {
    async fetchRepositoryTeams() {
      await Promise.resolve()
      return createSourceResult([createTeamSource()])
    },
    async fetchTeamMembers() {
      await Promise.resolve()
      return createSourceResult([createTeamMemberSource()])
    },
  }
}

function createFailingFetcher() {
  return {
    async fetchRepositoryTeams() {
      await Promise.resolve()
      throw new Error("rate limited")
    },
    async fetchTeamMembers() {
      await Promise.resolve()
      return createSourceResult([])
    },
  }
}

function createRepository(entries: readonly TeamMembershipCacheEntry[] = []) {
  const storedEntries = [...entries]

  return {
    entries: storedEntries,
    async listByRepo(repo: RepoName): Promise<TeamMembershipCache> {
      await Promise.resolve()
      return { entries: storedEntries, repo }
    },
    async upsert(_repo: RepoName, entry: TeamMembershipCacheEntry): Promise<void> {
      await Promise.resolve()
      storedEntries.push(entry)
    },
  }
}

function createLogger() {
  const events: LogInput[] = []

  return {
    events,
    async log(input: LogInput): Promise<void> {
      await Promise.resolve()
      events.push(input)
    },
  }
}

function createSourceResult(
  sources: readonly GitHubSourcePayloadWrapper[],
): GitHubGenericSourceFetchResult {
  return {
    cache: {},
    headers: {},
    notModified: false,
    sources,
    status: HTTP_STATUS_OK,
  }
}

function createExpectedEntry(): TeamMembershipCacheEntry {
  return {
    expiresAt: "2026-05-01T01:00:00.000Z",
    members: ["tj"],
    syncedAt: SYNCED_AT,
    team: {
      kind: "team",
      members: ["tj"],
      name: "Platform",
      org: "acme",
      slug: "platform",
      teamId: TEAM_ENTITY_ID,
      url: "https://github.com/orgs/acme/teams/platform",
    },
  }
}

function createTeamSource(): GitHubSourcePayloadWrapper {
  return {
    apiUrl: "https://api.github.com/orgs/acme/teams/platform",
    entityId: TEAM_ENTITY_ID,
    fetchedAt: FETCHED_AT,
    payload: {
      html_url: "https://github.com/orgs/acme/teams/platform",
      id: TEAM_ENTITY_ID,
      name: "Platform",
      slug: "platform",
    },
    repo: REPO,
    sourceKind: "team",
  }
}

function createTeamMemberSource(): GitHubSourcePayloadWrapper {
  return {
    apiUrl: "https://api.github.com/users/tj",
    entityId: TEAM_MEMBER_ENTITY_ID,
    fetchedAt: FETCHED_AT,
    payload: {
      id: TEAM_MEMBER_ENTITY_ID,
      login: "tj",
    },
    repo: REPO,
    sourceKind: "team_member",
  }
}
