import { IsoDateTimeSchema, RawGitHubPayloadSchema, SourceJsonReferenceSchema } from "./shared.js"
import type { DeepReadonly } from "./readonly.js"
import type { LocalNotification } from "./notification.js"
import { MINIMUM_TEXT_LENGTH } from "../constants.js"
import { z } from "zod"

const RawGitHubPayloadTypeSchema = RawGitHubPayloadSchema

export const DebugWarningSeveritySchema = z.enum(["info", "warn", "error"])

export const DebugWarningSchema = z.object({
  id: z.string().min(MINIMUM_TEXT_LENGTH),
  message: z.string().min(MINIMUM_TEXT_LENGTH),
  severity: DebugWarningSeveritySchema,
  sourceReference: SourceJsonReferenceSchema.optional(),
})

export const LogEventLevelSchema = z.enum(["debug", "info", "warn", "error"])

export const LogEventSchema = z.object({
  data: z.json().optional(),
  event: z.string().min(MINIMUM_TEXT_LENGTH),
  level: LogEventLevelSchema,
  message: z.string().min(MINIMUM_TEXT_LENGTH).optional(),
  timestamp: IsoDateTimeSchema,
})

/** Debug view links a generated notification back to raw payloads and mapping warnings. */
export interface DebugNotificationView {
  readonly notification: LocalNotification
  readonly rawSources: readonly RawGitHubPayloadValue[]
  readonly warnings: readonly DebugWarning[]
}

type RawGitHubPayloadValue = DeepReadonly<z.infer<typeof RawGitHubPayloadTypeSchema>>

export type DebugWarningSeverity = DeepReadonly<z.infer<typeof DebugWarningSeveritySchema>>
export type DebugWarning = DeepReadonly<z.infer<typeof DebugWarningSchema>>
export type LogEventLevel = DeepReadonly<z.infer<typeof LogEventLevelSchema>>
export type LogEvent = DeepReadonly<z.infer<typeof LogEventSchema>>
