import { z } from "zod";

import type { LocalNotification } from "./notification.js";
import type { DeepReadonly } from "./readonly.js";
import { IsoDateTimeSchema, SourceJsonReferenceSchema } from "./shared.js";
import type { RawGitHubPayload } from "./shared.js";

export const DebugWarningSeveritySchema = z.enum(["info", "warn", "error"]);

export const DebugWarningSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1),
  severity: DebugWarningSeveritySchema,
  sourceReference: SourceJsonReferenceSchema.optional(),
});

export const LogEventLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const LogEventSchema = z.object({
  data: z.json().optional(),
  event: z.string().min(1),
  level: LogEventLevelSchema,
  message: z.string().min(1).optional(),
  timestamp: IsoDateTimeSchema,
});

/** Debug view links a generated notification back to raw payloads and mapping warnings. */
export interface DebugNotificationView {
  readonly notification: LocalNotification;
  readonly rawSources: readonly RawGitHubPayload[];
  readonly warnings: readonly DebugWarning[];
}

export type DebugWarningSeverity = DeepReadonly<z.infer<typeof DebugWarningSeveritySchema>>;
export type DebugWarning = DeepReadonly<z.infer<typeof DebugWarningSchema>>;
export type LogEventLevel = DeepReadonly<z.infer<typeof LogEventLevelSchema>>;
export type LogEvent = DeepReadonly<z.infer<typeof LogEventSchema>>;
