import type { TeamMembershipCache, TeamMembershipCacheEntry } from "../domain/team-cache.js"
import type { GitHubGenericSourceFetchResult } from "../github/source-types.js"
import type { GitHubSourcePayloadWrapper } from "../domain/github-source.js"
import type { LogInput } from "../logger/types.js"
import { MINIMUM_TEXT_LENGTH } from "../constants.js"
import type { RepoName } from "../domain/shared.js"
import { z } from "zod"

const REPO_OWNER_INDEX = 0
const NEXT_INDEX_OFFSET = 1
const START_INDEX = 0

/**
 * Raw subset returned by GitHub's "List teams" endpoint.
 *
 * Source: https://docs.github.com/en/rest/teams/teams#list-teams
 */
const GitHubTeamPayloadSchema = z.looseObject({
  html_url: z.url().optional(),
  id: z.number().int().nonnegative(),
  name: z.string().min(MINIMUM_TEXT_LENGTH),
  slug: z.string().min(MINIMUM_TEXT_LENGTH),
})

/**
 * Raw subset returned by GitHub's "List team members" endpoint.
 *
 * Source: https://docs.github.com/en/rest/teams/members#list-team-members
 */
const GitHubTeamMemberPayloadSchema = z.looseObject({
  login: z.string().min(MINIMUM_TEXT_LENGTH),
})

export interface TeamCacheSyncFetcher {
  readonly fetchRepositoryTeams: (
    input: TeamCacheSyncRepositoryTeamsInput,
  ) => Promise<GitHubGenericSourceFetchResult>
  readonly fetchTeamMembers: (
    input: TeamCacheSyncTeamMembersInput,
  ) => Promise<GitHubGenericSourceFetchResult>
}

export interface TeamCacheSyncRepositoryTeamsInput {
  readonly repo: RepoName
}

export interface TeamCacheSyncTeamMembersInput {
  readonly org: string
  readonly repo: RepoName
  readonly teamSlug: string
}

export interface TeamCacheSyncRepository {
  readonly listByRepo: (repo: RepoName) => Promise<TeamMembershipCache>
  readonly upsert: (repo: RepoName, entry: TeamMembershipCacheEntry) => Promise<void>
}

export interface TeamCacheSyncLogger {
  readonly log: (input: LogInput) => Promise<unknown>
}

export interface TeamCacheSyncOptions {
  readonly fetcher: TeamCacheSyncFetcher
  readonly logger: TeamCacheSyncLogger
  readonly now?: () => Date
  readonly repository: TeamCacheSyncRepository
  readonly syncIntervalSeconds: number
}

/** Refreshes cached repo team members for participant filter expansion. */
export class TeamCacheSync {
  readonly #fetcher: TeamCacheSyncFetcher
  readonly #logger: TeamCacheSyncLogger
  readonly #now: () => Date
  readonly #repository: TeamCacheSyncRepository
  readonly #syncIntervalSeconds: number

  constructor(options: TeamCacheSyncOptions) {
    this.#fetcher = options.fetcher
    this.#logger = options.logger
    this.#now = options.now ?? (() => new Date())
    this.#repository = options.repository
    this.#syncIntervalSeconds = options.syncIntervalSeconds
  }

  /**
   * Returns fresh cache on success; on sync failure, logs and returns the last cached data.
   */
  async sync(repo: RepoName): Promise<TeamMembershipCache> {
    try {
      const teams = await this.#fetcher.fetchRepositoryTeams({ repo })

      await this.#syncTeamSources(repo, teams.sources, START_INDEX)
    } catch (error) {
      await this.#logger.log({
        data: { error: getErrorMessage(error), repo },
        event: "team_sync_failed",
        level: "warn",
        message: `Team sync failed for ${repo}; using cached team membership data.`,
      })
    }

    return this.#repository.listByRepo(repo)
  }

  async #syncTeamSources(
    repo: RepoName,
    teamSources: readonly GitHubSourcePayloadWrapper[],
    index: number,
  ): Promise<void> {
    const teamSource = teamSources.at(index)

    if (teamSource === undefined) {
      return
    }

    await this.#syncTeam(repo, teamSource)
    await this.#syncTeamSources(repo, teamSources, index + NEXT_INDEX_OFFSET)
  }

  async #syncTeam(repo: RepoName, teamSource: GitHubSourcePayloadWrapper): Promise<void> {
    const team = GitHubTeamPayloadSchema.parse(teamSource.payload)
    const members = await this.#fetcher.fetchTeamMembers({
      org: getRepoOwner(repo),
      repo,
      teamSlug: team.slug,
    })

    await this.#repository.upsert(repo, this.#createEntry(teamSource, members.sources))
  }

  #createEntry(
    teamSource: GitHubSourcePayloadWrapper,
    memberSources: readonly GitHubSourcePayloadWrapper[],
  ): TeamMembershipCacheEntry {
    const team = GitHubTeamPayloadSchema.parse(teamSource.payload)
    const members = memberSources.map(
      (source) => GitHubTeamMemberPayloadSchema.parse(source.payload).login,
    )
    const syncedAt = this.#now()

    return {
      expiresAt: new Date(
        syncedAt.getTime() + secondsToMilliseconds(this.#syncIntervalSeconds),
      ).toISOString(),
      members,
      syncedAt: syncedAt.toISOString(),
      team: {
        kind: "team",
        members,
        name: team.name,
        org: getRepoOwner(teamSource.repo),
        slug: team.slug,
        teamId: team.id,
        ...optionalUrl(team.html_url),
      },
    }
  }
}

function getRepoOwner(repo: RepoName) {
  const owner = repo.split("/").at(REPO_OWNER_INDEX)

  if (owner === undefined) {
    throw new Error(`Invalid repository name: ${repo}`)
  }

  return owner
}

function secondsToMilliseconds(seconds: number) {
  const millisecondsPerSecond = 1000

  return seconds * millisecondsPerSecond
}

function optionalUrl(url: string | undefined): { readonly url?: string } {
  return url === undefined ? {} : { url }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
