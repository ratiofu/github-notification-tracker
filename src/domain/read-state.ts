import { z } from "zod";

import type { DeepReadonly } from "./readonly.js";
import { IsoDateTimeSchema, LocalNotificationIdSchema } from "./shared.js";
import type { LocalNotificationId, NotificationThreadId } from "./shared.js";

export const ReadStateSchema = z.object({
  isRead: z.boolean(),
  notificationId: LocalNotificationIdSchema,
  readAt: IsoDateTimeSchema.nullable(),
});

/** Runtime snapshot used by summary row Space toggles to restore child read states. */
export interface SummaryReadStateSnapshot {
  readonly childStates: readonly SummaryChildReadState[];
  readonly threadId: NotificationThreadId;
}

export interface SummaryChildReadState {
  readonly isRead: boolean;
  readonly notificationId: LocalNotificationId;
}

export type ReadState = DeepReadonly<z.infer<typeof ReadStateSchema>>;
