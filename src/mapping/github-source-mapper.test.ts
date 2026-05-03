import type {
  GitHubPullRequestSource,
  GitHubSourcePayloadWrapper,
} from "../domain/github-source.js"
import { describe, expect, it } from "vitest"
import { mapGitHubSources } from "./github-source-mapper.js"
const CHECK_RUN_ID = 303
const COMMENT_ID = 101
const EXPECTED_RAW_PAYLOADS = 2
const MALFORMED_ID = 909
const MENTION_ID = 202
const NOW = "2026-05-02T14:00:00.000Z"
const OCTOCAT_ID = 1001
const PREFIX_MENTION_ID = 203
const PR_ID = 42_042
const PR_NUMBER = 42
const REVIEW_COMMENT_ID = 404
const REVIEW_ID = 505
const REVIEWER_ID = 5005
const RAW_SOURCE_INDEX = 1
const TIMELINE_CLOSED_ID = 808
const TIMELINE_MERGED_ID = 707
const TIMELINE_REVIEW_ID = 606
const VALID_LOCAL_ID = "localNotification0001"

type JsonValue = GitHubSourcePayloadWrapper["payload"]
describe("GitHub source mapping", () => {
  it("maps issue comments into unread local notifications and thread records", mapsIssueComments)
  it("maps user and team mentions into explicit targets", mapsMentions)
  it("maps failed check runs and ignores successful checks", mapsFailedChecks)
  it("maps review activity into review notifications", mapsReviewActivity)
  it("maps timeline events into lifecycle notifications", mapsTimelineEvents)
  it("excludes authenticated-user activity with a warning", excludesAuthenticatedUserActivity)
  it("records unsupported payload warnings with raw payload fallbacks", recordsUnsupportedPayloads)
})

function mapsIssueComments(): void {
  const result = mapSources([createCommentSource(COMMENT_ID, "Please take a look")])

  expect(result.thread.notificationIds).toStrictEqual([VALID_LOCAL_ID])
  expect(result.rawPayloads).toHaveLength(EXPECTED_RAW_PAYLOADS)
  expect(result.warnings).toStrictEqual([])
  expect(result.notifications).toStrictEqual([
    expect.objectContaining({
      actor: { id: OCTOCAT_ID, login: "octocat", url: "https://github.com/octocat" },
      createdAt: NOW,
      id: VALID_LOCAL_ID,
      isRead: false,
      sourceFingerprint: "issue_comment:pr_comment:101",
      text: "Please take a look",
      threadId: "pr:42042",
      title: "pr comment on #42",
      type: "pr_comment",
    }),
  ])
}

function mapsMentions(): void {
  const result = mapSources([
    createCommentSource(MENTION_ID, "(@tj) please check @acme/platform"),
    createCommentSource(PREFIX_MENTION_ID, "@tj-dev please check"),
  ])

  expect(result.notifications).toStrictEqual([
    expect.objectContaining({
      explicitTargets: [
        { kind: "user", login: "tj" },
        { kind: "team", org: "acme", slug: "platform" },
      ],
      sourceFingerprint: "issue_comment:mention:202",
      type: "mention",
    }),
    expect.objectContaining({
      sourceFingerprint: "issue_comment:pr_comment:203",
      type: "pr_comment",
    }),
  ])
}

function mapsFailedChecks(): void {
  const result = mapSources([createCheckRunSource("failure"), createCheckRunSource("success")])

  expect(result.notifications).toStrictEqual([
    expect.objectContaining({
      sourceFingerprint: "check_run:failed_check:303",
      text: "failure",
      title: "ci",
      type: "failed_check",
    }),
  ])
  expect(result.warnings).toStrictEqual([
    expect.objectContaining({ message: "Unsupported GitHub source activity" }),
  ])
}

function mapsReviewActivity(): void {
  const result = mapSources([createReviewCommentSource(), createReviewSource()])

  expect(result.notifications).toStrictEqual([
    expect.objectContaining({
      sourceFingerprint: "review_comment:pr_review_comment:404",
      title: "pr review comment on #42",
      type: "pr_review_comment",
    }),
    expect.objectContaining({
      sourceFingerprint: "review:pr_review_submission:505",
      text: "APPROVED",
      type: "pr_review_submission",
    }),
  ])
}

function mapsTimelineEvents(): void {
  const result = mapSources([
    createReviewRequestedTimelineSource(),
    createTimelineSource(TIMELINE_MERGED_ID, "merged"),
    createTimelineSource(TIMELINE_CLOSED_ID, "closed"),
  ])

  expect(result.notifications).toStrictEqual([
    expect.objectContaining({
      explicitTargets: [{ kind: "user", login: "mona" }],
      sourceFingerprint: "timeline_event:review_request:606",
      type: "review_request",
    }),
    expect.objectContaining({ sourceFingerprint: "timeline_event:pr_merged:707" }),
    expect.objectContaining({ sourceFingerprint: "timeline_event:pr_closed:808" }),
  ])
}

function excludesAuthenticatedUserActivity(): void {
  const result = mapSources([createCommentSource(COMMENT_ID, "Please take a look")], "octocat")

  expect(result.notifications).toStrictEqual([])
  expect(result.warnings).toStrictEqual([
    expect.objectContaining({
      message: "Ignored authenticated-user activity",
      sourceReference: {
        sourceId: String(COMMENT_ID),
        sourceKind: "issue_comment",
        storageKey: "issue_comment:101",
      },
    }),
  ])
}

function recordsUnsupportedPayloads(): void {
  const result = mapSources([createMalformedSource()])

  expect(result.notifications).toStrictEqual([])
  expect(result.rawPayloads[RAW_SOURCE_INDEX]).toStrictEqual({
    payload: {
      fetchedAt: NOW,
      id: String(MALFORMED_ID),
      payload: {},
    },
    storageKey: "timeline_event:909",
  })
  expect(result.warnings).toStrictEqual([
    expect.objectContaining({ message: "Unsupported GitHub source payload" }),
  ])
}

function mapSources(sources: readonly GitHubSourcePayloadWrapper[], authenticatedUserLogin = "tj") {
  return mapGitHubSources({
    authenticatedUserLogin,
    createNotificationId: () => VALID_LOCAL_ID,
    now: () => new Date(NOW),
    pullRequestSource: createPullRequestSource(),
    sources,
  })
}

function createPullRequestSource(): GitHubPullRequestSource {
  return {
    entityId: PR_ID,
    fetchedAt: NOW,
    headSha: "abc123",
    payload: {
      base: { ref: "main" },
      head: { ref: "feature", sha: "abc123" },
      html_url: `https://github.com/acme/widgets/pull/${String(PR_NUMBER)}`,
      id: PR_ID,
      merged_at: null,
      number: PR_NUMBER,
      state: "open",
      title: "Add widgets",
      user: {
        html_url: "https://github.com/mona",
        id: REVIEWER_ID,
        login: "mona",
      },
    },
    pullRequestNumber: PR_NUMBER,
    repo: "acme/widgets",
    sourceKind: "pull_request",
    state: "open",
    updatedAt: NOW,
  }
}

function createReviewCommentSource(): GitHubSourcePayloadWrapper {
  return createActivitySource("review_comment", REVIEW_COMMENT_ID, {
    body: "Nit",
    created_at: NOW,
    html_url: "https://github.com/acme/widgets/pull/42#discussion_r404",
    id: REVIEW_COMMENT_ID,
    user: createOctocatUser(),
  })
}

function createReviewSource(): GitHubSourcePayloadWrapper {
  return createActivitySource("review", REVIEW_ID, {
    id: REVIEW_ID,
    state: "APPROVED",
    submitted_at: NOW,
    user: createOctocatUser(),
  })
}

function createReviewRequestedTimelineSource(): GitHubSourcePayloadWrapper {
  return createActivitySource("timeline_event", TIMELINE_REVIEW_ID, {
    event: "review_requested",
    id: TIMELINE_REVIEW_ID,
    requested_reviewer: {
      html_url: "https://github.com/mona",
      id: REVIEWER_ID,
      login: "mona",
    },
  })
}

function createTimelineSource(id: number, event: string): GitHubSourcePayloadWrapper {
  return createActivitySource("timeline_event", id, {
    actor: createOctocatUser(),
    event,
    id,
  })
}

function createCommentSource(id: number, body: string): GitHubSourcePayloadWrapper {
  return {
    apiUrl: `https://api.github.com/repos/acme/widgets/issues/comments/${String(id)}`,
    entityId: id,
    fetchedAt: NOW,
    payload: {
      body,
      created_at: NOW,
      html_url: `https://github.com/acme/widgets/pull/42#issuecomment-${String(id)}`,
      id,
      updated_at: NOW,
      user: {
        html_url: "https://github.com/octocat",
        id: OCTOCAT_ID,
        login: "octocat",
      },
    },
    repo: "acme/widgets",
    sourceKind: "issue_comment",
  }
}

function createCheckRunSource(conclusion: string): GitHubSourcePayloadWrapper {
  return createActivitySource("check_run", CHECK_RUN_ID, {
    completed_at: NOW,
    conclusion,
    html_url: "https://github.com/acme/widgets/actions/runs/303",
    id: CHECK_RUN_ID,
    name: "ci",
    started_at: NOW,
  })
}

function createMalformedSource(): GitHubSourcePayloadWrapper {
  return {
    entityId: MALFORMED_ID,
    fetchedAt: NOW,
    payload: {},
    repo: "acme/widgets",
    sourceKind: "timeline_event",
  }
}

function createActivitySource(
  sourceKind: GitHubSourcePayloadWrapper["sourceKind"],
  entityId: number,
  payload: Record<string, JsonValue>,
): GitHubSourcePayloadWrapper {
  return {
    entityId,
    fetchedAt: NOW,
    payload,
    repo: "acme/widgets",
    sourceKind,
  }
}

function createOctocatUser() {
  return { html_url: "https://github.com/octocat", id: OCTOCAT_ID, login: "octocat" }
}
