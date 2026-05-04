import type { LocalNotification, LocalNotificationType } from "./notification.js"
import type { PullRequestMetadata, PullRequestThread } from "./notification-thread.js"
import type { RawGitHubPayload } from "./shared.js"
import type { TeamMembershipCacheEntry } from "./team-cache.js"

const COMMENT_PAYLOAD_ID = 1
const DEFAULT_PR_NUMBER = 42
const GITHUB_COMMENT_ENTITY_ID = 2002
const MONA_USER_ID = 99
const OCTOCAT_USER_ID = 1001
const PLATFORM_TEAM_ID = 123

export interface PullRequestThreadFixtureOptions {
  readonly id?: string
  readonly notificationIds?: readonly string[]
  readonly number?: number
  readonly sourceUpdatedAt?: string
}

export interface LocalNotificationFixtureOptions {
  readonly createdAt?: string
  readonly id?: string
  readonly sourceFingerprint?: string
  readonly sourceTimestamp?: string
  readonly thread?: PullRequestThread
  readonly title?: string
  readonly type?: LocalNotificationType
}

/** Reusable valid domain fixtures keep repository and mapper tests aligned with schemas. */
export function createThreadFixture(
  options: PullRequestThreadFixtureOptions = {},
): PullRequestThread {
  const pullRequest = createPullRequestMetadataFixture(options.number ?? DEFAULT_PR_NUMBER)

  return {
    notificationIds: options.notificationIds ?? ["ln00000000000001"],
    pullRequest,
    thread: {
      id: options.id ?? "pr:acme/widgets:42",
      kind: "pull_request",
      repo: "acme/widgets",
      sourceUpdatedAt: options.sourceUpdatedAt ?? "2026-05-01T00:00:00.000Z",
      targetUrl: pullRequest.url,
      title: pullRequest.title,
    },
  }
}

export function createNotificationFixture(
  options: LocalNotificationFixtureOptions = {},
): LocalNotification {
  const thread = options.thread ?? createThreadFixture()

  return {
    actor: createOctocatActor(),
    createdAt: options.createdAt ?? "2026-05-01T00:00:00.000Z",
    explicitTargets: [{ kind: "user", login: "tj" }],
    githubEntityId: GITHUB_COMMENT_ENTITY_ID,
    id: options.id ?? "ln00000000000001",
    isRead: false,
    parentPr: thread.pullRequest,
    parentPrState: "open",
    participants: [createOctocatParticipant()],
    readAt: null,
    sourceFingerprint: options.sourceFingerprint ?? "comment:1",
    sourceJsonReferences: [createCommentReference()],
    sourceTimestamp: options.sourceTimestamp ?? "2026-05-01T00:00:00.000Z",
    targetUrl: "https://github.com/acme/widgets/pull/42#issuecomment-1",
    text: "Please take a look",
    threadId: thread.thread.id,
    title: options.title ?? "PR comment",
    type: options.type ?? "pr_comment",
  }
}

export function createPullRequestMetadataFixture(number: number): PullRequestMetadata {
  return {
    author: {
      id: MONA_USER_ID,
      login: "mona",
      url: "https://github.com/mona",
    },
    baseRef: "main",
    entityId: number,
    headRef: "feature",
    headSha: "abc123",
    number,
    repo: "acme/widgets",
    state: "open",
    title: `Add feature ${number}`,
    url: `https://github.com/acme/widgets/pull/${number}`,
  }
}

export function createRawPayloadFixture(): RawGitHubPayload {
  return {
    apiUrl: "https://api.github.com/repos/acme/widgets/issues/comments/1",
    fetchedAt: "2026-05-01T00:00:00.000Z",
    htmlUrl: "https://github.com/acme/widgets/pull/42#issuecomment-1",
    id: "1",
    payload: {
      body: "Please take a look",
      id: COMMENT_PAYLOAD_ID,
    },
  }
}

export function createTeamEntryFixture(): TeamMembershipCacheEntry {
  return {
    expiresAt: "2026-05-01T01:00:00.000Z",
    members: ["tj", "octocat"],
    syncedAt: "2026-05-01T00:00:00.000Z",
    team: {
      kind: "team",
      members: ["tj", "octocat"],
      name: "Platform",
      org: "acme",
      slug: "platform",
      teamId: PLATFORM_TEAM_ID,
      url: "https://github.com/orgs/acme/teams/platform",
    },
  }
}

function createOctocatActor() {
  return {
    id: OCTOCAT_USER_ID,
    login: "octocat",
    url: "https://github.com/octocat",
  }
}

function createOctocatParticipant() {
  return {
    id: OCTOCAT_USER_ID,
    kind: "user",
    login: "octocat",
  } as const
}

function createCommentReference() {
  return {
    sourceId: "1",
    sourceKind: "pull_request_comment",
    storageKey: "pulls/42/comment/1",
  }
}
