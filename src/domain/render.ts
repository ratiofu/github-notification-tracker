import type { ApiStatus } from "./api-status.js";
import type { LocalNotificationType } from "./notification.js";
import type { PullRequestMetadata } from "./notification-thread.js";
import type { LocalNotificationId, Url } from "./shared.js";

export type RenderRowKind = "summary" | "detail";

export interface RenderRowBase {
  readonly id: string;
  readonly isFocused: boolean;
  readonly isUnread: boolean;
  readonly lineOne: string;
  readonly lineTwo: string;
  readonly targetUrl: Url;
}

export interface SummaryRenderRow extends RenderRowBase {
  readonly kind: "summary";
  readonly pullRequest: PullRequestMetadata;
  readonly unreadCount: number;
}

export interface DetailRenderRow extends RenderRowBase {
  readonly kind: "detail";
  readonly notificationId: LocalNotificationId;
  readonly notificationType: LocalNotificationType;
}

/** Render rows are memory-only output from thread and notification reducers. */
export type RenderRow = SummaryRenderRow | DetailRenderRow;

/** Complete immutable view model consumed by the Ink renderer. */
export interface RenderView {
  readonly apiStatus: ApiStatus;
  readonly rows: readonly RenderRow[];
  readonly showFooter: boolean;
  readonly summaryMode: boolean;
  readonly unreadCount: number;
  readonly unreadOnly: boolean;
}
