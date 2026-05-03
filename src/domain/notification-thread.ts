import {
  GitHubActorSchema,
  GitHubEntityIdSchema,
  IsoDateTimeSchema,
  LocalNotificationIdSchema,
  NotificationThreadIdSchema,
  RepoNameSchema,
  UrlSchema,
} from "./shared.js"
import type { DeepReadonly } from "./readonly.js"
import { MINIMUM_TEXT_LENGTH } from "../constants.js"
import { z } from "zod"

export const NotificationThreadKindSchema = z.enum(["pull_request"])

export const NotificationThreadSchema = z.object({
  id: NotificationThreadIdSchema,
  kind: NotificationThreadKindSchema,
  repo: RepoNameSchema,
  sourceUpdatedAt: IsoDateTimeSchema,
  targetUrl: UrlSchema,
  title: z.string().min(MINIMUM_TEXT_LENGTH),
})

export const PullRequestStateSchema = z.enum(["open", "closed", "merged"])

/**
 * Stable PR metadata copied onto threads, notifications, and render rows.
 *
 * Source: https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
 */
export const PullRequestMetadataSchema = z.object({
  author: GitHubActorSchema,
  baseRef: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  entityId: GitHubEntityIdSchema.optional(),
  headRef: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  headSha: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  number: z.number().int().positive(),
  repo: RepoNameSchema,
  state: PullRequestStateSchema,
  title: z.string().min(MINIMUM_TEXT_LENGTH),
  url: UrlSchema,
})

/** A PR notification thread groups local notifications under one parent PR. */
export const PullRequestThreadSchema = z.object({
  notificationIds: z.array(LocalNotificationIdSchema),
  pullRequest: PullRequestMetadataSchema,
  thread: NotificationThreadSchema,
})

export type NotificationThreadKind = DeepReadonly<z.infer<typeof NotificationThreadKindSchema>>
export type NotificationThread = DeepReadonly<z.infer<typeof NotificationThreadSchema>>
export type PullRequestState = DeepReadonly<z.infer<typeof PullRequestStateSchema>>
export type PullRequestMetadata = DeepReadonly<z.infer<typeof PullRequestMetadataSchema>>
export type PullRequestThread = DeepReadonly<z.infer<typeof PullRequestThreadSchema>>
