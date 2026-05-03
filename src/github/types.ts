import type { IsoDateTime } from "../domain/shared.js"

export type GitHubHttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT"

export type GitHubApiStatusEventKind =
  | "request_failed"
  | "request_retried"
  | "request_started"
  | "request_succeeded"

export interface GitHubApiStatusEvent {
  readonly kind: GitHubApiStatusEventKind
  readonly message?: string
  readonly method: GitHubHttpMethod
  readonly requestId: string
  readonly retryAfterMs?: number
  readonly route: string
  readonly status?: number
  readonly timestamp: IsoDateTime
}

export interface GitHubRequestInput {
  readonly etag?: string
  readonly headers?: Record<string, string>
  readonly lastModified?: string
  readonly method: GitHubHttpMethod
  readonly paginate?: boolean
  readonly parameters?: Record<string, unknown>
  readonly perPage?: number
  readonly route: string
  readonly signal?: AbortSignal
}

export interface GitHubRestClientOptions {
  readonly maxRetries?: number
  readonly now?: () => Date
  readonly onStatusEvent?: (event: GitHubApiStatusEvent) => void
  readonly sleep?: (milliseconds: number) => Promise<void>
  readonly token: string
  readonly transport?: GitHubTransport
}

export type GitHubTransportHeaders = Record<string, number | string | undefined>

export interface GitHubTransportResponse<TData> {
  readonly data: TData
  readonly headers: GitHubTransportHeaders
  readonly status: number
}

export interface GitHubRestResponse<TData> {
  readonly data: TData | undefined
  readonly headers: GitHubTransportHeaders
  readonly notModified: boolean
  readonly status: number
}

/** Minimal client contract used by higher-level GitHub source fetchers. */
export interface GitHubRestRequester {
  readonly request: <TData = unknown>(
    input: GitHubRequestInput,
  ) => Promise<GitHubRestResponse<TData>>
}

/** Abstracts Octokit requests so adapter behavior can be tested without network calls. */
export interface GitHubTransport {
  readonly request: <TData>(
    route: string,
    params: Record<string, unknown>,
  ) => Promise<GitHubTransportResponse<TData>>
}
