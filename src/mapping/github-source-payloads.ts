import type { GitHubActor } from "../domain/shared.js"
import { MINIMUM_TEXT_LENGTH } from "../constants.js"
import { z } from "zod"

const FALLBACK_ACTOR_LOGIN = "github"

export const NullableTextSchema = z.string().nullable().optional()

/**
 * GitHub user subset used by mapper source payload schemas.
 *
 * Source: https://docs.github.com/en/rest/users/users#get-the-authenticated-user
 */
export const ActorPayloadSchema = z.looseObject({
  avatar_url: z.url().optional(),
  html_url: z.url().optional(),
  id: z.union([z.number().int().nonnegative(), z.string().min(MINIMUM_TEXT_LENGTH)]).optional(),
  login: z.string().min(MINIMUM_TEXT_LENGTH),
  url: z.url().optional(),
})

/**
 * GitHub team subset used for timeline review-request targets.
 *
 * Source: https://docs.github.com/en/rest/teams/teams#list-teams
 */
export const TeamPayloadSchema = z.looseObject({
  html_url: z.url().optional(),
  id: z.union([z.number().int().nonnegative(), z.string().min(MINIMUM_TEXT_LENGTH)]).optional(),
  name: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  slug: z.string().min(MINIMUM_TEXT_LENGTH),
})

/**
 * Pull request subset copied from GitHub's pull request response.
 *
 * Source: https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
 */
export const PullRequestMapperPayloadSchema = z.looseObject({
  base: z.looseObject({ ref: z.string().min(MINIMUM_TEXT_LENGTH) }).optional(),
  head: z
    .looseObject({
      ref: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
      sha: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
    })
    .optional(),
  html_url: z.url(),
  id: z.union([z.number().int().nonnegative(), z.string().min(MINIMUM_TEXT_LENGTH)]).optional(),
  merged_at: z.iso.datetime({ offset: true }).nullable().optional(),
  number: z.number().int().positive(),
  state: z.enum(["open", "closed"]),
  title: z.string().min(MINIMUM_TEXT_LENGTH),
  user: ActorPayloadSchema,
})

/**
 * Comment/review/check/timeline subset copied from GitHub REST activity endpoints.
 *
 * Sources:
 * - https://docs.github.com/en/rest/issues/comments#list-issue-comments-for-a-repository
 * - https://docs.github.com/en/rest/pulls/comments#list-review-comments-on-a-pull-request
 * - https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request
 * - https://docs.github.com/en/rest/issues/timeline#list-timeline-events-for-an-issue
 * - https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference
 */
export const SourceActivityPayloadSchema = z.looseObject({
  actor: ActorPayloadSchema.optional(),
  body: NullableTextSchema,
  completed_at: z.iso.datetime({ offset: true }).nullable().optional(),
  conclusion: z.string().nullable().optional(),
  created_at: z.iso.datetime({ offset: true }).optional(),
  event: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  html_url: z.url().optional(),
  id: z.union([z.number().int().nonnegative(), z.string().min(MINIMUM_TEXT_LENGTH)]),
  name: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  requested_reviewer: ActorPayloadSchema.optional(),
  requested_team: TeamPayloadSchema.optional(),
  state: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  submitted_at: z.iso.datetime({ offset: true }).optional(),
  title: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  updated_at: z.iso.datetime({ offset: true }).optional(),
  url: z.url().optional(),
  user: ActorPayloadSchema.optional(),
})

export type PullRequestMapperPayload = z.infer<typeof PullRequestMapperPayloadSchema>
export type SourceActivityPayload = z.infer<typeof SourceActivityPayloadSchema>

export function normalizeActor(payload: SourceActivityPayload["user"]): GitHubActor {
  return {
    ...(payload?.avatar_url === undefined ? {} : { avatarUrl: payload.avatar_url }),
    ...(payload?.id === undefined ? {} : { id: payload.id }),
    login: payload?.login ?? FALLBACK_ACTOR_LOGIN,
    ...(payload?.html_url === undefined ? {} : { url: payload.html_url }),
  }
}
