import { z } from "zod";

import type { DeepReadonly } from "./readonly.js";
import {
  GitHubActorSchema,
  GitHubEntityIdSchema,
  IsoDateTimeSchema,
  LocalNotificationIdSchema,
  NotificationThreadIdSchema,
  RepoNameSchema,
  UrlSchema,
} from "./shared.js";

export const NotificationThreadKindSchema = z.enum(["pull_request"]);

export const NotificationThreadSchema = z.object({
  id: NotificationThreadIdSchema,
  kind: NotificationThreadKindSchema,
  repo: RepoNameSchema,
  sourceUpdatedAt: IsoDateTimeSchema,
  targetUrl: UrlSchema,
  title: z.string().min(1),
});

export const PullRequestStateSchema = z.enum(["open", "closed", "merged"]);

/**
 * Stable PR metadata copied onto threads, notifications, and render rows.
 *
 * Source: https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
 */
export const PullRequestMetadataSchema = z.object({
  author: GitHubActorSchema,
  baseRef: z.string().min(1).optional(),
  entityId: GitHubEntityIdSchema.optional(),
  headRef: z.string().min(1).optional(),
  headSha: z.string().min(1).optional(),
  number: z.number().int().positive(),
  repo: RepoNameSchema,
  state: PullRequestStateSchema,
  title: z.string().min(1),
  url: UrlSchema,
});

/** A PR notification thread groups local notifications under one parent PR. */
export const PullRequestThreadSchema = z.object({
  notificationIds: z.array(LocalNotificationIdSchema),
  pullRequest: PullRequestMetadataSchema,
  thread: NotificationThreadSchema,
});

export type NotificationThreadKind = DeepReadonly<z.infer<typeof NotificationThreadKindSchema>>;
export type NotificationThread = DeepReadonly<z.infer<typeof NotificationThreadSchema>>;
export type PullRequestState = DeepReadonly<z.infer<typeof PullRequestStateSchema>>;
export type PullRequestMetadata = DeepReadonly<z.infer<typeof PullRequestMetadataSchema>>;
export type PullRequestThread = DeepReadonly<z.infer<typeof PullRequestThreadSchema>>;
