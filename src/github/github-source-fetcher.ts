import type {
  GitHubCheckRunFetchInput,
  GitHubFetchedAt,
  GitHubGenericSourceFetchResult,
  GitHubPullRequestFetchInput,
  GitHubPullRequestSourceFetchResult,
  GitHubRepoFetchInput,
  GitHubSourceFetcherOptions,
  GitHubSourceKind,
  GitHubTeamMemberFetchInput,
} from "./source-types.js"
import {
  createCacheValidatorRequestFields,
  createOptionalAbortSignal,
  createOptionalPaginate,
  createOptionalParameters,
  createOptionalPerPage,
  createPullRequestSource,
  createResult,
  createSourceWrappers,
  splitRepoName,
} from "./github-source-fetcher-helpers.js"
import type { GitHubRestResponse } from "./types.js"
import { MINIMUM_TEXT_LENGTH } from "../constants.js"
import { z } from "zod"

const JsonArraySchema = z.array(z.json())

/**
 * Raw collection envelope from GitHub's check-runs-for-ref endpoint.
 *
 * Source: https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference
 */
const CheckRunsApiPayloadSchema = z.looseObject({
  check_runs: z.array(z.json()),
  total_count: z.number().int().nonnegative(),
})

/**
 * Raw subset returned by GitHub's "Get a pull request" REST endpoint.
 *
 * Source: https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
 */
const PullRequestApiPayloadSchema = z.looseObject({
  head: z.object({
    sha: z.string().min(MINIMUM_TEXT_LENGTH),
  }),
  html_url: z.url(),
  id: z.number().int().nonnegative(),
  number: z.number().int().positive(),
  state: z.enum(["open", "closed"]),
  updated_at: z.iso.datetime({ offset: true }),
  url: z.url(),
})

/**
 * Fetches raw GitHub source records and validates only the local wrapper shape.
 *
 * The fetcher keeps API routing separate from later mapping policy: callers decide which
 * PRs need detail refreshes, while this class returns raw payload wrappers for those calls.
 */
export class GitHubSourceFetcher {
  readonly #client: GitHubSourceFetcherOptions["client"]
  readonly #now: () => Date

  constructor(options: GitHubSourceFetcherOptions) {
    this.#client = options.client
    this.#now = options.now ?? (() => new Date())
  }

  /** Poll entry point: repository events are read before deciding which PRs need details. */
  async fetchRepositoryActivity(
    input: GitHubRepoFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    const result = await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/events",
      sourceKind: "timeline_event",
    })

    return result
  }

  async fetchPullRequest(
    input: GitHubPullRequestFetchInput,
  ): Promise<GitHubPullRequestSourceFetchResult> {
    const response = await this.#request({
      input,
      route: "/repos/{owner}/{repo}/pulls/{pull_number}",
      parameters: {
        pull_number: input.pullRequestNumber,
      },
    })

    if (response.notModified) {
      return createResult(response, [])
    }

    const payload = PullRequestApiPayloadSchema.parse(response.data)
    const source = createPullRequestSource(payload, input.repo, this.#fetchedAt())

    return createResult(response, [source])
  }

  async fetchPullRequestTimeline(
    input: GitHubPullRequestFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    const result = await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/issues/{issue_number}/timeline",
      sourceKind: "timeline_event",
      parameters: {
        issue_number: input.pullRequestNumber,
      },
    })

    return result
  }

  async fetchIssueComments(
    input: GitHubPullRequestFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    const result = await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/issues/{issue_number}/comments",
      sourceKind: "issue_comment",
      parameters: {
        issue_number: input.pullRequestNumber,
      },
    })

    return result
  }

  async fetchReviewComments(
    input: GitHubPullRequestFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    const result = await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/pulls/{pull_number}/comments",
      sourceKind: "review_comment",
      parameters: {
        pull_number: input.pullRequestNumber,
      },
    })

    return result
  }

  async fetchReviews(input: GitHubPullRequestFetchInput): Promise<GitHubGenericSourceFetchResult> {
    const result = await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      sourceKind: "review",
      parameters: {
        pull_number: input.pullRequestNumber,
      },
    })

    return result
  }

  async fetchCheckRuns(input: GitHubCheckRunFetchInput): Promise<GitHubGenericSourceFetchResult> {
    const response = await this.#request<unknown>({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/commits/{ref}/check-runs",
      parameters: {
        ref: input.headSha,
      },
    })

    if (response.notModified) {
      return createResult(response, [])
    }

    const payload = CheckRunsApiPayloadSchema.parse(response.data)
    const sources = createSourceWrappers(
      payload.check_runs,
      input.repo,
      "check_run",
      this.#fetchedAt(),
    )

    return createResult(response, sources)
  }

  async fetchRepositoryTeams(input: GitHubRepoFetchInput): Promise<GitHubGenericSourceFetchResult> {
    const result = await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/teams",
      sourceKind: "team",
    })

    return result
  }

  async fetchTeamMembers(
    input: GitHubTeamMemberFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    const response = await this.#client.request<unknown[]>({
      method: "GET",
      paginate: true,
      parameters: {
        org: input.org,
        team_slug: input.teamSlug,
      },
      route: "/orgs/{org}/teams/{team_slug}/members",
      ...createCacheValidatorRequestFields(input.cache),
      ...createOptionalPerPage(input.perPage),
      ...createOptionalAbortSignal(input.signal),
    })

    if (response.notModified) {
      return createResult(response, [])
    }

    const sources = createSourceWrappers(
      JsonArraySchema.parse(response.data),
      input.repo,
      "team_member",
      this.#fetchedAt(),
    )

    return createResult(response, sources)
  }

  async #fetchSourceList(options: {
    readonly input: GitHubRepoFetchInput
    readonly paginate: boolean
    readonly parameters?: Record<string, unknown>
    readonly route: string
    readonly sourceKind: GitHubSourceKind
  }): Promise<GitHubGenericSourceFetchResult> {
    const response = await this.#request({
      input: options.input,
      paginate: options.paginate,
      route: options.route,
      ...createOptionalParameters(options.parameters),
    })

    if (response.notModified) {
      return createResult(response, [])
    }

    const sources = createSourceWrappers(
      JsonArraySchema.parse(response.data),
      options.input.repo,
      options.sourceKind,
      this.#fetchedAt(),
    )

    return createResult(response, sources)
  }

  async #request<TData>(options: {
    readonly input: GitHubRepoFetchInput
    readonly paginate?: boolean
    readonly parameters?: Record<string, unknown>
    readonly route: string
  }): Promise<GitHubRestResponse<TData>> {
    const { owner, repo } = splitRepoName(options.input.repo)

    const response = await this.#client.request<TData>({
      method: "GET",
      parameters: {
        ...options.parameters,
        owner,
        repo,
      },
      route: options.route,
      ...createCacheValidatorRequestFields(options.input.cache),
      ...createOptionalPaginate(options.paginate),
      ...createOptionalPerPage(options.input.perPage),
      ...createOptionalAbortSignal(options.input.signal),
    })

    return response
  }

  #fetchedAt(): GitHubFetchedAt {
    return this.#now().toISOString()
  }
}
