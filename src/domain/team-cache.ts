import { IsoDateTimeSchema, RepoNameSchema } from "./shared.js"
import type { DeepReadonly } from "./readonly.js"
import { MINIMUM_TEXT_LENGTH } from "../constants.js"
import { TeamParticipantSchema } from "./participant.js"
import { z } from "zod"

/** Cached team members expand team participant filters into user matches. */
export const TeamMembershipCacheEntrySchema = z.object({
  expiresAt: IsoDateTimeSchema,
  members: z.array(z.string().min(MINIMUM_TEXT_LENGTH)),
  syncedAt: IsoDateTimeSchema,
  team: TeamParticipantSchema,
})

export const TeamMembershipCacheSchema = z.object({
  entries: z.array(TeamMembershipCacheEntrySchema),
  repo: RepoNameSchema,
})

export type TeamMembershipCacheEntry = DeepReadonly<z.infer<typeof TeamMembershipCacheEntrySchema>>
export type TeamMembershipCache = DeepReadonly<z.infer<typeof TeamMembershipCacheSchema>>
