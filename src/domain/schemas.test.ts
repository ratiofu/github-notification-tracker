import { describe, expect, it } from "vitest";

import {
  AppConfigSchema,
  DebugWarningSchema,
  GitHubPullRequestSourceSchema,
  LocalNotificationSchema,
  LogEventSchema,
  ParticipantSchema,
  PersistedRuntimeConfigSchema,
  PullRequestThreadSchema,
  ReadStateSchema,
  TeamMembershipCacheSchema,
} from "./index.js";

const timestamp = "2026-05-02T05:00:00.000Z";
const url = "https://github.com/acme/widgets/pull/42";
const notificationId = "Abcdefghijklmnopqrs_1";

const actor = {
  id: 123,
  login: "octocat",
  url: "https://github.com/octocat",
};

const pullRequest = {
  author: actor,
  entityId: 42,
  headSha: "abc123",
  number: 42,
  repo: "acme/widgets",
  state: "open",
  title: "Add widget tracking",
  url,
} as const;

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
} as const;

describe("domain schemas", () => {
  it("parses config defaults and participant selections", () => {
    const config = AppConfigSchema.parse({
      participants: [{ kind: "team", org: "acme", slug: "platform" }],
      repo: "acme/widgets",
    });

    expect(config.github.patEnv).toBe("GITHUB_PAT");
    expect(config.pollIntervalSeconds).toBe(30);
    expect(config.participants).toHaveLength(1);
  });

  it("keeps missing persisted runtime overrides absent", () => {
    expect(PersistedRuntimeConfigSchema.parse({})).toEqual({});
    expect(
      PersistedRuntimeConfigSchema.parse({
        summaryMode: false,
      }),
    ).toEqual({ summaryMode: false });
  });

  it("parses required domain model groups", () => {
    expect(ParticipantSchema.parse({ kind: "user", login: "maintainer" })).toMatchObject({
      login: "maintainer",
    });

    expect(
      GitHubPullRequestSourceSchema.parse({
        fetchedAt: timestamp,
        headSha: "abc123",
        payload: { number: 42 },
        pullRequestNumber: 42,
        repo: "acme/widgets",
        sourceKind: "pull_request",
        state: "open",
        updatedAt: timestamp,
      }),
    ).toMatchObject({ pullRequestNumber: 42 });

    expect(() =>
      GitHubPullRequestSourceSchema.parse({
        fetchedAt: timestamp,
        headSha: "abc123",
        payload: { number: 42 },
        pullRequestNumber: 42,
        repo: "acme/widgets",
        sourceKind: "team",
        state: "open",
        updatedAt: timestamp,
      }),
    ).toThrow();

    expect(
      PullRequestThreadSchema.parse({
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
      }),
    ).toMatchObject({ thread: { kind: "pull_request" } });

    expect(LocalNotificationSchema.parse(notification)).toMatchObject({
      id: notificationId,
      type: "pr_comment",
    });

    expect(
      TeamMembershipCacheSchema.parse({
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
      }),
    ).toMatchObject({ entries: [{ members: ["maintainer"] }] });

    expect(
      ReadStateSchema.parse({
        isRead: true,
        notificationId,
        readAt: timestamp,
      }),
    ).toMatchObject({ isRead: true });

    expect(
      DebugWarningSchema.parse({
        id: "warning-1",
        message: "Partial mapping",
        severity: "warn",
      }),
    ).toMatchObject({ severity: "warn" });

    expect(
      LogEventSchema.parse({
        event: "team_sync_failed",
        level: "warn",
        timestamp,
      }),
    ).toMatchObject({ event: "team_sync_failed" });
  });

  it("rejects invalid repository names and local notification IDs", () => {
    expect(() => AppConfigSchema.parse({ repo: "missing-owner" })).toThrow();
    expect(() => LocalNotificationSchema.parse({ ...notification, id: "too-short" })).toThrow();
    expect(() =>
      PullRequestThreadSchema.parse({
        notificationIds: ["not-a-local-notification-id"],
        pullRequest,
        thread: {
          id: "pr:acme/widgets:42",
          kind: "pull_request",
          repo: "acme/widgets",
          sourceUpdatedAt: timestamp,
          targetUrl: url,
          title: "Add widget tracking",
        },
      }),
    ).toThrow();
  });
});
