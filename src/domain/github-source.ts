import { z } from "zod";

import type { DeepReadonly } from "./readonly.js";
import { GitHubEntityIdSchema, IsoDateTimeSchema, RepoNameSchema, UrlSchema } from "./shared.js";

export const GitHubSourceKindSchema = z.enum([
  "pull_request",
  "issue_comment",
  "review_comment",
  "review",
  "timeline_event",
  "check_run",
  "check_suite",
  "team",
  "team_member",
]);

/** Raw GitHub API payload plus the repo and source kind needed by mappers. */
export const GitHubSourcePayloadWrapperSchema = z.object({
  apiUrl: UrlSchema.optional(),
  entityId: GitHubEntityIdSchema.optional(),
  fetchedAt: IsoDateTimeSchema,
  payload: z.json(),
  repo: RepoNameSchema,
  sourceKind: GitHubSourceKindSchema,
});

/** Pull request wrapper used to create notification threads before child activity is mapped. */
export const GitHubPullRequestSourceSchema = GitHubSourcePayloadWrapperSchema.extend({
  headSha: z.string().min(1),
  pullRequestNumber: z.number().int().positive(),
  sourceKind: z.literal("pull_request"),
  state: z.enum(["open", "closed"]),
  updatedAt: IsoDateTimeSchema,
});

export type GitHubSourceKind = DeepReadonly<z.infer<typeof GitHubSourceKindSchema>>;
export type GitHubSourcePayloadWrapper = DeepReadonly<
  z.infer<typeof GitHubSourcePayloadWrapperSchema>
>;
export type GitHubPullRequestSource = DeepReadonly<z.infer<typeof GitHubPullRequestSourceSchema>>;
