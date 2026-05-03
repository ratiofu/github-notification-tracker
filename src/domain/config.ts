import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_TEAM_SYNC_INTERVAL_SECONDS,
  MINIMUM_TEXT_LENGTH,
} from "../constants.js"
import type { DeepReadonly } from "./readonly.js"
import { ParticipantSelectionSchema } from "./participant.js"
import { RepoNameSchema } from "./shared.js"
import { z } from "zod"

export const GitHubConfigSchema = z.object({
  patEnv: z.string().min(MINIMUM_TEXT_LENGTH).default("GITHUB_PAT"),
})

export const RuntimeSettingsSchema = z.object({
  participants: z.array(ParticipantSelectionSchema).default([]),
  pollIntervalSeconds: z.number().int().positive().default(DEFAULT_POLL_INTERVAL_SECONDS),
  showFooter: z.boolean().default(true),
  summaryMode: z.boolean().default(true),
  teamSyncIntervalSeconds: z.number().int().positive().default(DEFAULT_TEAM_SYNC_INTERVAL_SECONDS),
  unreadOnly: z.boolean().default(false),
})

export const RuntimeSettingsOverrideSchema = z.object({
  participants: z.array(ParticipantSelectionSchema).optional(),
  pollIntervalSeconds: z.number().int().positive().optional(),
  showFooter: z.boolean().optional(),
  summaryMode: z.boolean().optional(),
  teamSyncIntervalSeconds: z.number().int().positive().optional(),
  unreadOnly: z.boolean().optional(),
})

export const AppConfigSchema = RuntimeSettingsSchema.extend({
  github: GitHubConfigSchema.default({ patEnv: "GITHUB_PAT" }),
  repo: RepoNameSchema,
  retentionDays: z.number().int().positive().default(DEFAULT_RETENTION_DAYS),
})

export const PersistedRuntimeConfigSchema = RuntimeSettingsOverrideSchema

export type GitHubConfig = DeepReadonly<z.infer<typeof GitHubConfigSchema>>
export type RuntimeSettings = DeepReadonly<z.infer<typeof RuntimeSettingsSchema>>
export type RuntimeSettingsOverride = DeepReadonly<z.infer<typeof RuntimeSettingsOverrideSchema>>
export type AppConfig = DeepReadonly<z.infer<typeof AppConfigSchema>>
export type PersistedRuntimeConfig = DeepReadonly<z.infer<typeof PersistedRuntimeConfigSchema>>
