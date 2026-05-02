import { z } from "zod";

import type { DeepReadonly } from "./readonly.js";

/**
 * GitHub REST IDs are usually numeric, while activity event IDs are documented as strings.
 *
 * Sources:
 * - https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 * - https://docs.github.com/en/rest/activity/events#list-repository-events
 */
export const GitHubEntityIdSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);

export const LocalNotificationIdSchema = z.string().regex(/^[A-Za-z0-9_-]{21}$/);

export const SourceFingerprintSchema = z.string().min(1);
export const NotificationThreadIdSchema = z.string().min(1);
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const UrlSchema = z.url();
export const RepoNameSchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);

/**
 * Normalized subset of GitHub user objects used for actors/authors.
 *
 * Source: https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */
export const GitHubActorSchema = z.object({
  avatarUrl: UrlSchema.optional(),
  id: GitHubEntityIdSchema.optional(),
  login: z.string().min(1),
  url: UrlSchema.optional(),
});

export const SourceJsonReferenceSchema = z.object({
  sourceId: z.string().min(1),
  sourceKind: z.string().min(1),
  storageKey: z.string().min(1),
});

export const RawGitHubPayloadSchema = z.object({
  apiUrl: UrlSchema.optional(),
  fetchedAt: IsoDateTimeSchema,
  htmlUrl: UrlSchema.optional(),
  id: z.string().min(1),
  payload: z.json(),
});

export type GitHubEntityId = DeepReadonly<z.infer<typeof GitHubEntityIdSchema>>;
export type LocalNotificationId = DeepReadonly<z.infer<typeof LocalNotificationIdSchema>>;
export type SourceFingerprint = DeepReadonly<z.infer<typeof SourceFingerprintSchema>>;
export type NotificationThreadId = DeepReadonly<z.infer<typeof NotificationThreadIdSchema>>;
export type IsoDateTime = DeepReadonly<z.infer<typeof IsoDateTimeSchema>>;
export type Url = DeepReadonly<z.infer<typeof UrlSchema>>;
export type RepoName = DeepReadonly<z.infer<typeof RepoNameSchema>>;
export type GitHubActor = DeepReadonly<z.infer<typeof GitHubActorSchema>>;
export type SourceJsonReference = DeepReadonly<z.infer<typeof SourceJsonReferenceSchema>>;
export type RawGitHubPayload = DeepReadonly<z.infer<typeof RawGitHubPayloadSchema>>;
