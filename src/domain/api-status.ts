import type { IsoDateTime } from "./shared.js"

export type ApiStatusState = "idle" | "active" | "failed" | "stalled"

export interface ApiStatus {
  readonly inFlightCount: number
  readonly lastFailedAt?: IsoDateTime
  readonly lastStartedAt?: IsoDateTime
  readonly lastSuccessfulAt?: IsoDateTime
  readonly message?: string
  readonly state: ApiStatusState
}
