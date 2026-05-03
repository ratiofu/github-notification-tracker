import { ExplicitTargetSchema, ParticipantSchema } from "./participant.js"
import {
  GitHubActorSchema,
  GitHubEntityIdSchema,
  IsoDateTimeSchema,
  LocalNotificationIdSchema,
  NotificationThreadIdSchema,
  SourceFingerprintSchema,
  SourceJsonReferenceSchema,
  UrlSchema,
} from "./shared.js"
import { PullRequestMetadataSchema, PullRequestStateSchema } from "./notification-thread.js"
import type { DeepReadonly } from "./readonly.js"
import { MINIMUM_TEXT_LENGTH } from "../constants.js"
import { z } from "zod"

export const LocalNotificationTypeSchema = z.enum([
  "pr_comment",
  "pr_review_comment",
  "pr_review_submission",
  "review_request",
  "mention",
  "failed_check",
  "pr_merged",
  "pr_closed",
])

/** Local notification generated from GitHub source payloads and grouped by parent PR. */
export const LocalNotificationSchema = z.object({
  actor: GitHubActorSchema,
  createdAt: IsoDateTimeSchema,
  explicitTargets: z.array(ExplicitTargetSchema),
  githubEntityId: GitHubEntityIdSchema.optional(),
  id: LocalNotificationIdSchema,
  isRead: z.boolean(),
  parentPr: PullRequestMetadataSchema,
  parentPrState: PullRequestStateSchema,
  participants: z.array(ParticipantSchema),
  readAt: IsoDateTimeSchema.nullable(),
  sourceFingerprint: SourceFingerprintSchema,
  sourceJsonReferences: z.array(SourceJsonReferenceSchema),
  sourceTimestamp: IsoDateTimeSchema,
  targetUrl: UrlSchema,
  text: z.string().min(MINIMUM_TEXT_LENGTH),
  threadId: NotificationThreadIdSchema,
  title: z.string().min(MINIMUM_TEXT_LENGTH),
  type: LocalNotificationTypeSchema,
})

export type LocalNotificationType = DeepReadonly<z.infer<typeof LocalNotificationTypeSchema>>
export type LocalNotification = DeepReadonly<z.infer<typeof LocalNotificationSchema>>
