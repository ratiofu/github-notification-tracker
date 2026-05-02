import { describe, expect, it } from "vitest";

import { GitHubSourceFetcher } from "./GitHubSourceFetcher.js";
import type { GitHubRequestInput, GitHubRestRequester, GitHubRestResponse } from "./types.js";

const timestamp = "2026-05-02T12:00:00.000Z";

describe("GitHubSourceFetcher", () => {
  it("fetches repository activity first with pagination and cache validators", async () => {
    const client = new RecordingRestRequester([
      {
        data: [
          {
            id: "event-1",
            type: "PullRequestEvent",
            url: "https://api.github.com/repos/acme/widgets/events/1",
          },
        ],
        headers: { etag: '"next"', "last-modified": "Sat, 02 May 2026 12:00:00 GMT" },
        notModified: false,
        status: 200,
      },
    ]);
    const fetcher = createFetcher(client);

    const result = await fetcher.fetchRepositoryActivity({
      cache: { etag: '"old"' },
      perPage: 50,
      repo: "acme/widgets",
    });

    expect(client.requests).toEqual([
      {
        etag: '"old"',
        method: "GET",
        paginate: true,
        parameters: {
          owner: "acme",
          repo: "widgets",
        },
        perPage: 50,
        route: "/repos/{owner}/{repo}/events",
      },
    ]);
    expect(result.cache).toEqual({
      etag: '"next"',
      lastModified: "Sat, 02 May 2026 12:00:00 GMT",
    });
    expect(result.sources).toEqual([
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
    ]);
  });

  it("materializes pull request detail wrappers from the PR API payload", async () => {
    const client = new RecordingRestRequester([
      {
        data: {
          head: { sha: "abc123" },
          html_url: "https://github.com/acme/widgets/pull/42",
          id: 101,
          number: 42,
          state: "open",
          updated_at: timestamp,
          url: "https://api.github.com/repos/acme/widgets/pulls/42",
        },
        headers: {},
        notModified: false,
        status: 200,
      },
    ]);
    const fetcher = createFetcher(client);

    const result = await fetcher.fetchPullRequest({
      pullRequestNumber: 42,
      repo: "acme/widgets",
    });

    expect(client.requests[0]).toMatchObject({
      method: "GET",
      parameters: {
        owner: "acme",
        pull_number: 42,
        repo: "widgets",
      },
      route: "/repos/{owner}/{repo}/pulls/{pull_number}",
    });
    expect(result.sources).toEqual([
      expect.objectContaining({
        entityId: 101,
        headSha: "abc123",
        pullRequestNumber: 42,
        repo: "acme/widgets",
        sourceKind: "pull_request",
        state: "open",
        updatedAt: timestamp,
      }),
    ]);
  });

  it("returns no sources for conditional cache hits", async () => {
    const client = new RecordingRestRequester([
      {
        data: undefined,
        headers: { etag: '"cached"' },
        notModified: true,
        status: 304,
      },
    ]);
    const fetcher = createFetcher(client);

    const result = await fetcher.fetchReviews({
      cache: { lastModified: "Sat, 02 May 2026 12:00:00 GMT" },
      pullRequestNumber: 42,
      repo: "acme/widgets",
    });

    expect(client.requests[0]).toMatchObject({
      lastModified: "Sat, 02 May 2026 12:00:00 GMT",
      route: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
    });
    expect(result).toMatchObject({
      cache: { etag: '"cached"' },
      notModified: true,
      sources: [],
      status: 304,
    });
  });

  it("routes PR detail source lists to timeline, comment, review, and check APIs", async () => {
    const client = new RecordingRestRequester([
      createListResponse({ id: 1 }),
      createListResponse({ id: 2 }),
      createListResponse({ id: 3 }),
      createCheckRunsResponse([
        {
          id: 4,
          name: "ci",
          url: "https://api.github.com/repos/acme/widgets/check-runs/4",
        },
      ]),
    ]);
    const fetcher = createFetcher(client);
    const pullRequestInput = { pullRequestNumber: 42, repo: "acme/widgets" } as const;

    await fetcher.fetchPullRequestTimeline(pullRequestInput);
    await fetcher.fetchIssueComments(pullRequestInput);
    await fetcher.fetchReviewComments(pullRequestInput);
    await fetcher.fetchCheckRuns({ headSha: "abc123", repo: "acme/widgets" });

    expect(client.requests.map((request) => request.route)).toEqual([
      "/repos/{owner}/{repo}/issues/{issue_number}/timeline",
      "/repos/{owner}/{repo}/issues/{issue_number}/comments",
      "/repos/{owner}/{repo}/pulls/{pull_number}/comments",
      "/repos/{owner}/{repo}/commits/{ref}/check-runs",
    ]);
    expect(client.requests[3]?.parameters).toMatchObject({
      ref: "abc123",
    });
  });

  it("unwraps check-runs envelopes into individual source payloads", async () => {
    const client = new RecordingRestRequester([
      createCheckRunsResponse([
        {
          conclusion: "failure",
          id: 4,
          name: "test",
          url: "https://api.github.com/repos/acme/widgets/check-runs/4",
        },
        {
          conclusion: "success",
          id: 5,
          name: "lint",
          url: "https://api.github.com/repos/acme/widgets/check-runs/5",
        },
      ]),
    ]);
    const fetcher = createFetcher(client);

    const result = await fetcher.fetchCheckRuns({ headSha: "abc123", repo: "acme/widgets" });

    expect(result.sources).toEqual([
      expect.objectContaining({
        entityId: 4,
        payload: expect.objectContaining({ name: "test" }),
        sourceKind: "check_run",
      }),
      expect.objectContaining({
        entityId: 5,
        payload: expect.objectContaining({ name: "lint" }),
        sourceKind: "check_run",
      }),
    ]);
  });

  it("fetches repository teams and team members with source kinds that mappers can distinguish", async () => {
    const client = new RecordingRestRequester([
      createListResponse({ id: 7, name: "Platform", slug: "platform" }),
      createListResponse({ id: 99, login: "octocat" }),
    ]);
    const fetcher = createFetcher(client);

    const teams = await fetcher.fetchRepositoryTeams({ repo: "acme/widgets" });
    const members = await fetcher.fetchTeamMembers({
      org: "acme",
      repo: "acme/widgets",
      teamSlug: "platform",
    });

    expect(client.requests.map((request) => request.route)).toEqual([
      "/repos/{owner}/{repo}/teams",
      "/orgs/{org}/teams/{team_slug}/members",
    ]);
    expect(teams.sources[0]).toMatchObject({
      entityId: 7,
      sourceKind: "team",
    });
    expect(members.sources[0]).toMatchObject({
      entityId: 99,
      repo: "acme/widgets",
      sourceKind: "team_member",
    });
  });

  it("rejects malformed PR detail payloads at the GitHub boundary", async () => {
    const client = new RecordingRestRequester([
      {
        data: {
          number: 42,
          state: "open",
          updated_at: timestamp,
        },
        headers: {},
        notModified: false,
        status: 200,
      },
    ]);
    const fetcher = createFetcher(client);

    await expect(
      fetcher.fetchPullRequest({
        pullRequestNumber: 42,
        repo: "acme/widgets",
      }),
    ).rejects.toThrow();
  });
});

function createFetcher(client: GitHubRestRequester): GitHubSourceFetcher {
  return new GitHubSourceFetcher({
    client,
    now: () => new Date(timestamp),
  });
}

function createListResponse(payload: unknown): GitHubRestResponse<unknown[]> {
  return {
    data: [payload],
    headers: {},
    notModified: false,
    status: 200,
  };
}

function createCheckRunsResponse(payloads: readonly unknown[]): GitHubRestResponse<unknown> {
  return {
    data: {
      check_runs: payloads,
      total_count: payloads.length,
    },
    headers: {},
    notModified: false,
    status: 200,
  };
}

class RecordingRestRequester implements GitHubRestRequester {
  readonly requests: GitHubRequestInput[] = [];
  readonly #responses: GitHubRestResponse<unknown>[];

  constructor(responses: GitHubRestResponse<unknown>[]) {
    this.#responses = responses;
  }

  async request<TData = unknown>(input: GitHubRequestInput): Promise<GitHubRestResponse<TData>> {
    this.requests.push(input);
    const response = this.#responses.shift();

    if (response === undefined) {
      throw new Error("Unexpected GitHub request");
    }

    return response as GitHubRestResponse<TData>;
  }
}
