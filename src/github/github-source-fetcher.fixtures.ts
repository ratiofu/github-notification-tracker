import type { GitHubRequestInput, GitHubRestRequester, GitHubRestResponse } from "./types.js"
import { HTTP_NOT_MODIFIED_STATUS, HTTP_OK_STATUS } from "../constants.js"
import { GitHubSourceFetcher } from "./github-source-fetcher.js"

export const cacheHitStatus = HTTP_NOT_MODIFIED_STATUS
export const checkRunCiId = 4
export const checkRunFailureId = 4
export const checkRunSuccessId = 5
export const detailIssueCommentId = 2
export const detailReviewCommentId = 3
export const detailTimelineEventId = 1
export const expectedCheckRunCount = 2
export const firstIndex = 0
export const fourthIndex = 3
export const pullRequestEntityId = 101
export const pullRequestNumber = 42
export const repositoryActivityPerPage = 50
export const teamId = 7
export const teamMemberId = 99
export const secondIndex = 1

export const timestamp = "2026-05-02T12:00:00.000Z"

export function createFetcher(client: GitHubRestRequester): GitHubSourceFetcher {
  return new GitHubSourceFetcher({
    client,
    now: () => new Date(timestamp),
  })
}

export function createListResponse(payload: unknown): GitHubRestResponse<unknown[]> {
  return {
    data: [payload],
    headers: {},
    notModified: false,
    status: HTTP_OK_STATUS,
  }
}

export function createCheckRunsResponse(payloads: readonly unknown[]): GitHubRestResponse<unknown> {
  return {
    data: {
      check_runs: payloads,
      total_count: payloads.length,
    },
    headers: {},
    notModified: false,
    status: HTTP_OK_STATUS,
  }
}

export function createRepositoryActivityResponse(): GitHubRestResponse<unknown[]> {
  return {
    data: [
      {
        id: "event-1",
        type: "PullRequestEvent",
        url: "https://api.github.com/repos/acme/widgets/events/1",
      },
    ],
    headers: { etag: '"next"', "last-modified": "Sat, 02 May 2026 12:00:00 GMT" },
    notModified: false,
    status: HTTP_OK_STATUS,
  }
}

export function createPullRequestResponse(): GitHubRestResponse<unknown> {
  return {
    data: {
      head: { sha: "abc123" },
      html_url: "https://github.com/acme/widgets/pull/42",
      id: pullRequestEntityId,
      number: pullRequestNumber,
      state: "open",
      updated_at: timestamp,
      url: "https://api.github.com/repos/acme/widgets/pulls/42",
    },
    headers: {},
    notModified: false,
    status: HTTP_OK_STATUS,
  }
}

export function createCacheHitResponse(): GitHubRestResponse<unknown> {
  return {
    data: undefined,
    headers: { etag: '"cached"' },
    notModified: true,
    status: HTTP_NOT_MODIFIED_STATUS,
  }
}

export function createDetailListResponses(): readonly GitHubRestResponse<unknown>[] {
  return [
    createListResponse({ id: detailTimelineEventId }),
    createListResponse({ id: detailIssueCommentId }),
    createListResponse({ id: detailReviewCommentId }),
    createCheckRunsResponse([
      {
        id: checkRunCiId,
        name: "ci",
        url: "https://api.github.com/repos/acme/widgets/check-runs/4",
      },
    ]),
  ]
}

export function createCheckRuns(): readonly unknown[] {
  return [
    {
      conclusion: "failure",
      id: checkRunFailureId,
      name: "test",
      url: "https://api.github.com/repos/acme/widgets/check-runs/4",
    },
    {
      conclusion: "success",
      id: checkRunSuccessId,
      name: "lint",
      url: "https://api.github.com/repos/acme/widgets/check-runs/5",
    },
  ]
}

export function createMalformedPullRequestResponse(): GitHubRestResponse<unknown> {
  return {
    data: {
      number: pullRequestNumber,
      state: "open",
      updated_at: timestamp,
    },
    headers: {},
    notModified: false,
    status: HTTP_OK_STATUS,
  }
}

export class RecordingRestRequester implements GitHubRestRequester {
  readonly requests: GitHubRequestInput[] = []
  readonly #responses: GitHubRestResponse<unknown>[]

  constructor(responses: readonly GitHubRestResponse<unknown>[]) {
    this.#responses = [...responses]
  }

  async request<TData = unknown>(input: GitHubRequestInput): Promise<GitHubRestResponse<TData>> {
    this.requests.push(input)
    const response = this.#responses.shift()

    if (response === undefined) {
      throw new Error("Unexpected GitHub request")
    }

    await Promise.resolve()

    return response as GitHubRestResponse<TData>
  }
}
