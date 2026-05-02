import { z } from "zod";

import type { DeepReadonly } from "./readonly.js";
import { ParticipantSelectionSchema } from "./participant.js";
import { RepoNameSchema } from "./shared.js";

export const GitHubConfigSchema = z.object({
  patEnv: z.string().min(1).default("GITHUB_PAT"),
});

export const RuntimeSettingsSchema = z.object({
  participants: z.array(ParticipantSelectionSchema).default([]),
  pollIntervalSeconds: z.number().int().positive().default(30),
  showFooter: z.boolean().default(true),
  summaryMode: z.boolean().default(true),
  teamSyncIntervalSeconds: z.number().int().positive().default(3600),
  unreadOnly: z.boolean().default(false),
});

export const RuntimeSettingsOverrideSchema = z.object({
  participants: z.array(ParticipantSelectionSchema).optional(),
  pollIntervalSeconds: z.number().int().positive().optional(),
  showFooter: z.boolean().optional(),
  summaryMode: z.boolean().optional(),
  teamSyncIntervalSeconds: z.number().int().positive().optional(),
  unreadOnly: z.boolean().optional(),
});

export const AppConfigSchema = RuntimeSettingsSchema.extend({
  github: GitHubConfigSchema.default({ patEnv: "GITHUB_PAT" }),
  repo: RepoNameSchema,
  retentionDays: z.number().int().positive().default(90),
});

export const PersistedRuntimeConfigSchema = RuntimeSettingsOverrideSchema;

export type GitHubConfig = DeepReadonly<z.infer<typeof GitHubConfigSchema>>;
export type RuntimeSettings = DeepReadonly<z.infer<typeof RuntimeSettingsSchema>>;
export type RuntimeSettingsOverride = DeepReadonly<z.infer<typeof RuntimeSettingsOverrideSchema>>;
export type AppConfig = DeepReadonly<z.infer<typeof AppConfigSchema>>;
export type PersistedRuntimeConfig = DeepReadonly<z.infer<typeof PersistedRuntimeConfigSchema>>;
