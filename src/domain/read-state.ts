import { IsoDateTimeSchema, LocalNotificationIdSchema } from "./shared.js"
import type { DeepReadonly } from "./readonly.js"
import { z } from "zod"

type LocalNotificationIdValue = DeepReadonly<z.infer<typeof LocalNotificationIdSchema>>
type NotificationThreadIdValue = string

export const ReadStateSchema = z.object({
  isRead: z.boolean(),
  notificationId: LocalNotificationIdSchema,
  readAt: IsoDateTimeSchema.nullable(),
})

/** Runtime snapshot used by summary row Space toggles to restore child read states. */
export interface SummaryReadStateSnapshot {
  readonly childStates: readonly SummaryChildReadState[]
  readonly threadId: NotificationThreadIdValue
}

export interface SummaryChildReadState {
  readonly isRead: boolean
  readonly notificationId: LocalNotificationIdValue
}

export type ReadState = DeepReadonly<z.infer<typeof ReadStateSchema>>
