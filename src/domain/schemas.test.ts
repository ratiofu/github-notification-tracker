import { AppConfigSchema, PersistedRuntimeConfigSchema } from "./config.js"
import { DebugWarningSchema, LogEventSchema } from "./debug.js"
import { describe, expect, it } from "vitest"
import { DEFAULT_POLL_INTERVAL_SECONDS } from "../constants.js"
import { GitHubPullRequestSourceSchema } from "./github-source.js"
import { LocalNotificationSchema } from "./notification.js"
import { ParticipantSchema } from "./participant.js"
import { PullRequestThreadSchema } from "./notification-thread.js"
import { ReadStateSchema } from "./read-state.js"
import { TeamMembershipCacheSchema } from "./team-cache.js"

const timestamp = "2026-05-02T05:00:00.000Z"
const url = "https://github.com/acme/widgets/pull/42"
const notificationId = "Abcdefghijklmnopqrs_1"
const ACTOR_ID = 123
const EXPECTED_PARTICIPANT_COUNT = 1
const PULL_REQUEST_NUMBER = 42

const actor = {
  id: ACTOR_ID,
  login: "octocat",
  url: "https://github.com/octocat",
}

const pullRequest = {
  author: actor,
  entityId: PULL_REQUEST_NUMBER,
  headSha: "abc123",
  number: PULL_REQUEST_NUMBER,
  repo: "acme/widgets",
  state: "open",
  title: "Add widget tracking",
  url,
} as const

const notification = {
  actor,
  createdAt: timestamp,
  explicitTargets: [{ kind: "user", login: "maintainer" }],
  githubEntityId: "issue-comment-1",
  id: notificationId,
  isRead: false,
  parentPr: pullRequest,
  parentPrState: "open",
  participants: [{ kind: "user", login: "maintainer" }],
  readAt: null,
  sourceFingerprint: "comment:1:updated-at",
  sourceJsonReferences: [
    {
      sourceId: "issue-comment-1",
      sourceKind: "issue_comment",
      storageKey: "raw/issue-comment-1.json",
    },
  ],
  sourceTimestamp: timestamp,
  targetUrl: url,
  text: "Please review this change.",
  threadId: "pr:acme/widgets:42",
  title: "New PR comment",
  type: "pr_comment",
} as const

describe("domain schemas", () => {
  it("parses config defaults and participant selections", parsesConfigDefaults)
  it("keeps missing persisted runtime overrides absent", keepsRuntimeOverridesAbsent)
  it("parses participant models", parsesParticipantModels)
  it("parses GitHub pull request sources", parsesGitHubPullRequestSources)
  it("rejects non-PR GitHub source wrappers", rejectsNonPullRequestSources)
  it("parses notification thread models", parsesNotificationThreads)
  it("parses notification models", parsesNotifications)
  it("parses team membership cache models", parsesTeamMembershipCache)
  it("parses read state, debug, and log models", parsesOperationalModels)
  it("rejects invalid repository names and local notification IDs", rejectsInvalidIdentifiers)
})

function parsesConfigDefaults(): void {
  const config = AppConfigSchema.parse({
    participants: [{ kind: "team", org: "acme", slug: "platform" }],
    repo: "acme/widgets",
  })

  expect(config.github.patEnv).toBe("GITHUB_PAT")
  expect(config.pollIntervalSeconds).toBe(DEFAULT_POLL_INTERVAL_SECONDS)
  expect(config.participants).toHaveLength(EXPECTED_PARTICIPANT_COUNT)
}

function keepsRuntimeOverridesAbsent(): void {
  expect(PersistedRuntimeConfigSchema.parse({})).toStrictEqual({})
  expect(PersistedRuntimeConfigSchema.parse({ summaryMode: false })).toStrictEqual({
    summaryMode: false,
  })
}

function parsesParticipantModels(): void {
  expect(ParticipantSchema.parse({ kind: "user", login: "maintainer" })).toMatchObject({
    login: "maintainer",
  })
}

function parsesGitHubPullRequestSources(): void {
  expect(GitHubPullRequestSourceSchema.parse(createPullRequestSource())).toMatchObject({
    pullRequestNumber: PULL_REQUEST_NUMBER,
  })
}

function rejectsNonPullRequestSources(): void {
  expect(() =>
    GitHubPullRequestSourceSchema.parse({
      ...createPullRequestSource(),
      sourceKind: "team",
    }),
  ).toThrow("Invalid input")
}

function parsesNotificationThreads(): void {
  expect(PullRequestThreadSchema.parse(createPullRequestThread())).toMatchObject({
    thread: { kind: "pull_request" },
  })
}

function parsesNotifications(): void {
  expect(LocalNotificationSchema.parse(notification)).toMatchObject({
    id: notificationId,
    type: "pr_comment",
  })
}

function parsesTeamMembershipCache(): void {
  expect(TeamMembershipCacheSchema.parse(createTeamMembershipCache())).toMatchObject({
    entries: [{ members: ["maintainer"] }],
  })
}

function parsesOperationalModels(): void {
  expect(ReadStateSchema.parse(createReadState())).toMatchObject({ isRead: true })
  expect(DebugWarningSchema.parse(createDebugWarning())).toMatchObject({ severity: "warn" })
  expect(LogEventSchema.parse(createLogEvent())).toMatchObject({ event: "team_sync_failed" })
}

function rejectsInvalidIdentifiers(): void {
  expect(() => AppConfigSchema.parse({ repo: "missing-owner" })).toThrow("Invalid string")
  expect(() => LocalNotificationSchema.parse({ ...notification, id: "too-short" })).toThrow(
    "Invalid string",
  )
  expect(() =>
    PullRequestThreadSchema.parse({
      ...createPullRequestThread(),
      notificationIds: ["not-a-local-notification-id"],
    }),
  ).toThrow("Invalid string")
}

function createPullRequestSource() {
  return {
    fetchedAt: timestamp,
    headSha: "abc123",
    payload: { number: PULL_REQUEST_NUMBER },
    pullRequestNumber: PULL_REQUEST_NUMBER,
    repo: "acme/widgets",
    sourceKind: "pull_request",
    state: "open",
    updatedAt: timestamp,
  }
}

function createPullRequestThread() {
  return {
    notificationIds: [notificationId],
    pullRequest,
    thread: {
      id: "pr:acme/widgets:42",
      kind: "pull_request",
      repo: "acme/widgets",
      sourceUpdatedAt: timestamp,
      targetUrl: url,
      title: "Add widget tracking",
    },
  }
}

function createTeamMembershipCache() {
  return {
    entries: [
      {
        expiresAt: "2026-05-02T06:00:00.000Z",
        members: ["maintainer"],
        syncedAt: timestamp,
        team: {
          kind: "team",
          members: ["maintainer"],
          org: "acme",
          slug: "platform",
        },
      },
    ],
    repo: "acme/widgets",
  }
}

function createReadState() {
  return {
    isRead: true,
    notificationId,
    readAt: timestamp,
  }
}

function createDebugWarning() {
  return {
    id: "warning-1",
    message: "Partial mapping",
    severity: "warn",
  }
}

function createLogEvent() {
  return {
    event: "team_sync_failed",
    level: "warn",
    timestamp,
  }
}
