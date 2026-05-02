import type {
  LocalNotification,
  PullRequestMetadata,
  PullRequestThread,
  RawGitHubPayload,
  TeamMembershipCacheEntry,
} from "./index.js";

export interface PullRequestThreadFixtureOptions {
  readonly id?: string;
  readonly notificationIds?: readonly string[];
  readonly number?: number;
  readonly sourceUpdatedAt?: string;
}

export interface LocalNotificationFixtureOptions {
  readonly createdAt?: string;
  readonly id?: string;
  readonly sourceFingerprint?: string;
  readonly sourceTimestamp?: string;
  readonly thread?: PullRequestThread;
}

/** Reusable valid domain fixtures keep repository and mapper tests aligned with schemas. */
export function createThreadFixture(
  options: PullRequestThreadFixtureOptions = {},
): PullRequestThread {
  const pullRequest = createPullRequestMetadataFixture(options.number ?? 42);

  return {
    notificationIds: options.notificationIds ?? ["localNotification0001"],
    pullRequest,
    thread: {
      id: options.id ?? "pr:acme/widgets:42",
      kind: "pull_request",
      repo: "acme/widgets",
      sourceUpdatedAt: options.sourceUpdatedAt ?? "2026-05-01T00:00:00.000Z",
      targetUrl: pullRequest.url,
      title: pullRequest.title,
    },
  };
}

export function createNotificationFixture(
  options: LocalNotificationFixtureOptions = {},
): LocalNotification {
  const thread = options.thread ?? createThreadFixture();

  return {
    actor: {
      id: 1001,
      login: "octocat",
      url: "https://github.com/octocat",
    },
    createdAt: options.createdAt ?? "2026-05-01T00:00:00.000Z",
    explicitTargets: [{ kind: "user", login: "tj" }],
    githubEntityId: 2002,
    id: options.id ?? "localNotification0001",
    isRead: false,
    parentPr: thread.pullRequest,
    parentPrState: "open",
    participants: [
      {
        id: 1001,
        kind: "user",
        login: "octocat",
      },
    ],
    readAt: null,
    sourceFingerprint: options.sourceFingerprint ?? "comment:1",
    sourceJsonReferences: [
      {
        sourceId: "1",
        sourceKind: "pull_request_comment",
        storageKey: "pulls/42/comment/1",
      },
    ],
    sourceTimestamp: options.sourceTimestamp ?? "2026-05-01T00:00:00.000Z",
    targetUrl: "https://github.com/acme/widgets/pull/42#issuecomment-1",
    text: "Please take a look",
    threadId: thread.thread.id,
    title: "PR comment",
    type: "pr_comment",
  };
}

export function createPullRequestMetadataFixture(number: number): PullRequestMetadata {
  return {
    author: {
      id: 99,
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
  };
}

export function createRawPayloadFixture(): RawGitHubPayload {
  return {
    apiUrl: "https://api.github.com/repos/acme/widgets/issues/comments/1",
    fetchedAt: "2026-05-01T00:00:00.000Z",
    htmlUrl: "https://github.com/acme/widgets/pull/42#issuecomment-1",
    id: "1",
    payload: {
      body: "Please take a look",
      id: 1,
    },
  };
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
      teamId: 123,
      url: "https://github.com/orgs/acme/teams/platform",
    },
  };
}
