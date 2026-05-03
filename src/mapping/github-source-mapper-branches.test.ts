import type {
  GitHubPullRequestSource,
  GitHubSourcePayloadWrapper,
} from "../domain/github-source.js"
import { describe, expect, it } from "vitest"
import { LocalNotificationIdSchema } from "../domain/shared.js"
import { mapGitHubSources } from "./github-source-mapper.js"

const FIRST_NOTIFICATION_INDEX = 0
const PR_ID = 42_042
const PR_NUMBER = 42
const RAW_UNKNOWN_INDEX = 2
const TEAM_EVENT_ID = 111
const UPDATED_AT = "2026-05-02T14:00:00.000Z"

describe("GitHub source mapping branches", () => {
  it("uses default clocks and IDs when callers do not inject factories", usesDefaultFactories)
  it("maps requested teams and merged pull request metadata", mapsTeamRequests)
})

function usesDefaultFactories(): void {
  const result = mapGitHubSources({
    authenticatedUserLogin: "tj",
    pullRequestSource: createPullRequestSource("2026-05-02T14:00:00.000Z"),
    sources: [createDefaultCommentSource(), createUnsupportedSource()],
  })

  expect(result.rawPayloads[RAW_UNKNOWN_INDEX]).toStrictEqual({
    payload: { fetchedAt: UPDATED_AT, id: "unknown", payload: {} },
    storageKey: "timeline_event:unknown",
  })
  expect(
    LocalNotificationIdSchema.safeParse(result.notifications[FIRST_NOTIFICATION_INDEX]?.id),
  ).toMatchObject({
    success: true,
  })
}

function mapsTeamRequests(): void {
  const result = mapGitHubSources({
    authenticatedUserLogin: "tj",
    createNotificationId: () => "ln00000000000001",
    now: () => new Date(UPDATED_AT),
    pullRequestSource: createPullRequestSource(UPDATED_AT),
    sources: [createTeamReviewRequest()],
  })

  expect(result.thread.pullRequest.state).toBe("merged")
  expect(result.thread.thread.id).toBe("pr:42042")
  expect(result.notifications).toStrictEqual([
    expect.objectContaining({
      explicitTargets: [{ kind: "team", org: "acme", slug: "platform" }],
      sourceFingerprint: "timeline_event:review_request:111",
    }),
  ])
}

function createPullRequestSource(mergedAt: string): GitHubPullRequestSource {
  return {
    entityId: PR_ID,
    fetchedAt: UPDATED_AT,
    headSha: "abc123",
    payload: {
      html_url: "https://github.com/acme/widgets/pull/42",
      id: PR_ID,
      merged_at: mergedAt,
      number: PR_NUMBER,
      state: "closed",
      title: "Add widgets",
      user: { id: PR_ID, login: "mona" },
    },
    pullRequestNumber: PR_NUMBER,
    repo: "acme/widgets",
    sourceKind: "pull_request",
    state: "closed",
    updatedAt: UPDATED_AT,
  }
}

function createUnsupportedSource(): GitHubSourcePayloadWrapper {
  return {
    fetchedAt: UPDATED_AT,
    payload: {},
    repo: "acme/widgets",
    sourceKind: "timeline_event",
  }
}

function createDefaultCommentSource(): GitHubSourcePayloadWrapper {
  return {
    entityId: TEAM_EVENT_ID,
    fetchedAt: UPDATED_AT,
    payload: {
      body: "Ping",
      id: TEAM_EVENT_ID,
      user: { id: TEAM_EVENT_ID, login: "octocat" },
    },
    repo: "acme/widgets",
    sourceKind: "issue_comment",
  }
}

function createTeamReviewRequest(): GitHubSourcePayloadWrapper {
  return {
    entityId: TEAM_EVENT_ID,
    fetchedAt: UPDATED_AT,
    payload: {
      event: "review_requested",
      id: TEAM_EVENT_ID,
      requested_team: { slug: "platform" },
    },
    repo: "acme/widgets",
    sourceKind: "timeline_event",
  }
}
