import { z } from "zod";

import type { DeepReadonly } from "./readonly.js";
import { GitHubEntityIdSchema, UrlSchema } from "./shared.js";
import type { GitHubEntityId } from "./shared.js";

export const ParticipantKindSchema = z.enum(["user", "team"]);

export const GitHubLoginSchema = z.string().min(1);

/**
 * Normalized user participant fields derived from GitHub user objects.
 *
 * Source: https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */
export const UserParticipantSchema = z.object({
  avatarUrl: UrlSchema.optional(),
  displayName: z.string().min(1).optional(),
  id: GitHubEntityIdSchema.optional(),
  kind: z.literal("user"),
  login: GitHubLoginSchema,
});

/**
 * Normalized team participant fields derived from GitHub team responses.
 *
 * Source: https://docs.github.com/en/rest/teams/teams#list-teams
 */
export const TeamParticipantSchema = z.object({
  kind: z.literal("team"),
  members: z.array(GitHubLoginSchema).default([]),
  name: z.string().min(1).optional(),
  org: GitHubLoginSchema,
  slug: z.string().min(1),
  teamId: GitHubEntityIdSchema.optional(),
  url: UrlSchema.optional(),
});

export const ParticipantSchema = z.discriminatedUnion("kind", [
  UserParticipantSchema,
  TeamParticipantSchema,
]);

export const ParticipantSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("user"),
    login: GitHubLoginSchema,
  }),
  z.object({
    kind: z.literal("team"),
    org: GitHubLoginSchema,
    slug: z.string().min(1),
  }),
]);

export const ExplicitTargetSchema = ParticipantSelectionSchema;

export type ParticipantKind = DeepReadonly<z.infer<typeof ParticipantKindSchema>>;
export type GitHubLogin = DeepReadonly<z.infer<typeof GitHubLoginSchema>>;
export type UserParticipant = DeepReadonly<z.infer<typeof UserParticipantSchema>>;
export type TeamParticipant = DeepReadonly<z.infer<typeof TeamParticipantSchema>>;
export type Participant = DeepReadonly<z.infer<typeof ParticipantSchema>>;
export type ParticipantSelection = DeepReadonly<z.infer<typeof ParticipantSelectionSchema>>;
export type ExplicitTarget = DeepReadonly<z.infer<typeof ExplicitTargetSchema>>;

export interface ParticipantFilterIndex {
  readonly teamIds: ReadonlySet<GitHubEntityId>;
  readonly teamSlugs: ReadonlySet<string>;
  readonly userIds: ReadonlySet<GitHubEntityId>;
  readonly userLogins: ReadonlySet<GitHubLogin>;
}
