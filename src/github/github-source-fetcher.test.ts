import {
  RecordingRestRequester,
  cacheHitStatus,
  checkRunFailureId,
  checkRunSuccessId,
  createCacheHitResponse,
  createCheckRuns,
  createCheckRunsResponse,
  createDetailListResponses,
  createFetcher,
  createListResponse,
  createMalformedPullRequestResponse,
  createPullRequestResponse,
  createRepositoryActivityResponse,
  expectedCheckRunCount,
  firstIndex,
  fourthIndex,
  pullRequestEntityId,
  pullRequestNumber,
  repositoryActivityPerPage,
  secondIndex,
  teamId,
  teamMemberId,
  timestamp,
} from "./github-source-fetcher.fixtures.js"
import { describe, expect, it } from "vitest"

type GitHubGenericSourceFetchResult = Awaited<
  ReturnType<ReturnType<typeof createFetcher>["fetchRepositoryActivity"]>
>

describe("repository activity", () => {
  it("fetches newest activity with pagination and cache validators", async () => {
    const client = new RecordingRestRequester([createRepositoryActivityResponse()])
    const fetcher = createFetcher(client)

    const result = await fetcher.fetchRepositoryActivity({
      cache: { etag: '"old"' },
      perPage: repositoryActivityPerPage,
      repo: "acme/widgets",
    })

    expectRepositoryActivityRequest(client)
    expectRepositoryActivityResult(result)
  })
})

describe("pull request detail", () => {
  it("materializes wrappers from the PR API payload", async () => {
    const client = new RecordingRestRequester([createPullRequestResponse()])
    const fetcher = createFetcher(client)

    const result = await fetcher.fetchPullRequest({
      pullRequestNumber,
      repo: "acme/widgets",
    })

    expectPullRequestDetailRequest(client)
    expectPullRequestDetailSource(result)
  })
})

describe("malformed pull request detail", () => {
  it("rejects malformed PR payloads at the GitHub boundary", async () => {
    const client = new RecordingRestRequester([createMalformedPullRequestResponse()])
    const fetcher = createFetcher(client)

    await expect(
      fetcher.fetchPullRequest({
        pullRequestNumber,
        repo: "acme/widgets",
      }),
    ).rejects.toThrow("Invalid input")
  })
})

describe("conditional requests", () => {
  it("returns no sources for cache hits", async () => {
    const client = new RecordingRestRequester([createCacheHitResponse()])
    const fetcher = createFetcher(client)

    const result = await fetcher.fetchReviews({
      cache: { lastModified: "Sat, 02 May 2026 12:00:00 GMT" },
      pullRequestNumber,
      repo: "acme/widgets",
    })

    expect(client.requests[firstIndex]).toMatchObject({
      lastModified: "Sat, 02 May 2026 12:00:00 GMT",
      route: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
    })
    expect(result).toMatchObject({
      cache: { etag: '"cached"' },
      notModified: true,
      sources: [],
      status: cacheHitStatus,
    })
  })
})

describe("detail source lists", () => {
  it("routes timeline, comment, review, and check APIs", async () => {
    const client = new RecordingRestRequester(createDetailListResponses())
    const fetcher = createFetcher(client)
    const pullRequestInput = { pullRequestNumber, repo: "acme/widgets" } as const

    await fetcher.fetchPullRequestTimeline(pullRequestInput)
    await fetcher.fetchIssueComments(pullRequestInput)
    await fetcher.fetchReviewComments(pullRequestInput)
    await fetcher.fetchCheckRuns({ headSha: "abc123", repo: "acme/widgets" })

    expect(client.requests.map((request) => request.route)).toStrictEqual([
      "/repos/{owner}/{repo}/issues/{issue_number}/timeline",
      "/repos/{owner}/{repo}/issues/{issue_number}/comments",
      "/repos/{owner}/{repo}/pulls/{pull_number}/comments",
      "/repos/{owner}/{repo}/commits/{ref}/check-runs",
    ])
    expect(client.requests[fourthIndex]?.parameters).toMatchObject({ ref: "abc123" })
  })

  it("unwraps check-runs envelopes into individual source payloads", async () => {
    const client = new RecordingRestRequester([createCheckRunsResponse(createCheckRuns())])
    const fetcher = createFetcher(client)

    const result = await fetcher.fetchCheckRuns({ headSha: "abc123", repo: "acme/widgets" })

    expectCheckRunSources(result)
  })
})

describe("team sources", () => {
  it("fetches repository teams and team members with distinct source kinds", async () => {
    const client = new RecordingRestRequester([
      createListResponse({ id: teamId, name: "Platform", slug: "platform" }),
      createListResponse({ id: teamMemberId, login: "octocat" }),
    ])
    const fetcher = createFetcher(client)

    const teams = await fetcher.fetchRepositoryTeams({ repo: "acme/widgets" })
    const members = await fetcher.fetchTeamMembers({
      org: "acme",
      repo: "acme/widgets",
      teamSlug: "platform",
    })

    expect(client.requests.map((request) => request.route)).toStrictEqual([
      "/repos/{owner}/{repo}/teams",
      "/orgs/{org}/teams/{team_slug}/members",
    ])
    expect(teams.sources[firstIndex]).toMatchObject({ entityId: teamId, sourceKind: "team" })
    expect(members.sources[firstIndex]).toMatchObject({
      entityId: teamMemberId,
      repo: "acme/widgets",
      sourceKind: "team_member",
    })
  })
})

describe("recording requester", () => {
  it("reports unexpected requests", async () => {
    const client = new RecordingRestRequester([])

    await expect(
      client.request({
        method: "GET",
        route: "/unexpected",
      }),
    ).rejects.toThrow("Unexpected GitHub request")
  })
})

function expectRepositoryActivityRequest(client: RecordingRestRequester): void {
  expect(client.requests).toStrictEqual([
    {
      etag: '"old"',
      method: "GET",
      paginate: true,
      parameters: {
        owner: "acme",
        repo: "widgets",
      },
      perPage: repositoryActivityPerPage,
      route: "/repos/{owner}/{repo}/events",
    },
  ])
}

function expectRepositoryActivityResult(result: GitHubGenericSourceFetchResult): void {
  expect(result.cache).toStrictEqual({
    etag: '"next"',
    lastModified: "Sat, 02 May 2026 12:00:00 GMT",
  })
  expect(result.sources).toStrictEqual([
    {
      apiUrl: "https://api.github.com/repos/acme/widgets/events/1",
      entityId: "event-1",
      fetchedAt: timestamp,
      payload: {
        id: "event-1",
        type: "PullRequestEvent",
        url: "https://api.github.com/repos/acme/widgets/events/1",
      },
      repo: "acme/widgets",
      sourceKind: "timeline_event",
    },
  ])
}

function expectPullRequestDetailRequest(client: RecordingRestRequester): void {
  expect(client.requests[firstIndex]).toMatchObject({
    method: "GET",
    parameters: {
      owner: "acme",
      pull_number: pullRequestNumber,
      repo: "widgets",
    },
    route: "/repos/{owner}/{repo}/pulls/{pull_number}",
  })
}

function expectPullRequestDetailSource(result: GitHubGenericSourceFetchResult): void {
  expect(result.sources).toStrictEqual([
    expect.objectContaining({
      entityId: pullRequestEntityId,
      headSha: "abc123",
      pullRequestNumber,
      repo: "acme/widgets",
      sourceKind: "pull_request",
      state: "open",
      updatedAt: timestamp,
    }),
  ])
}

function expectCheckRunSources(result: GitHubGenericSourceFetchResult): void {
  expect(result.sources).toHaveLength(expectedCheckRunCount)
  expect(result.sources[firstIndex]).toMatchObject({
    entityId: checkRunFailureId,
    sourceKind: "check_run",
  })
  expect(result.sources[firstIndex]?.payload).toMatchObject({ name: "test" })
  expect(result.sources[secondIndex]).toMatchObject({
    entityId: checkRunSuccessId,
    sourceKind: "check_run",
  })
  expect(result.sources[secondIndex]?.payload).toMatchObject({ name: "lint" })
}
