import type {
  GitHubRequestInput,
  GitHubRestResponse,
  GitHubTransportHeaders,
  GitHubTransportResponse,
} from "./types.js"
import { MINIMUM_POSITIVE_INTEGER } from "../constants.js"

export const INITIAL_ATTEMPT = MINIMUM_POSITIVE_INTEGER
export const NEXT_ATTEMPT_INCREMENT = 1

const DEFAULT_PER_PAGE = 100
const FIRST_CAPTURE_GROUP_INDEX = 1
const HTTP_FORBIDDEN_STATUS = 403
const HTTP_RATE_LIMIT_STATUS = 429
const HTTP_SERVER_ERROR_MINIMUM_STATUS = 500
const MILLISECONDS_PER_SECOND = 1000

/** Builds Octokit request parameters while preserving caller-supplied conditional validators. */
export function createRequestParams(input: GitHubRequestInput): Record<string, unknown> {
  const headers: Record<string, string> = {
    ...input.headers,
  }

  if (input.etag !== undefined) {
    headers["if-none-match"] = input.etag
  }

  if (input.lastModified !== undefined) {
    headers["if-modified-since"] = input.lastModified
  }

  return {
    ...input.parameters,
    headers,
    per_page: input.perPage ?? DEFAULT_PER_PAGE,
    request: {
      signal: input.signal,
    },
  }
}

/** Normalizes response headers for case-insensitive downstream cache validator lookups. */
export function normalizeResponse<TData>(
  response: GitHubTransportResponse<TData>,
): GitHubRestResponse<TData> {
  return {
    data: response.data,
    headers: normalizeHeaders(response.headers),
    notModified: false,
    status: response.status,
  }
}

export interface ParsedGitHubRequestError {
  readonly headers: GitHubTransportHeaders
  readonly message: string
  readonly status: number | undefined
}

export function parseGitHubRequestError(error: unknown): ParsedGitHubRequestError {
  if (typeof error === "object" && error !== null) {
    const errorRecord = error as {
      readonly message?: unknown
      readonly response?: {
        readonly headers?: GitHubTransportHeaders
      }
      readonly status?: unknown
    }

    return {
      headers: normalizeHeaders(errorRecord.response?.headers),
      message:
        typeof errorRecord.message === "string" ? errorRecord.message : "GitHub request failed",
      status: typeof errorRecord.status === "number" ? errorRecord.status : undefined,
    }
  }

  return {
    headers: {},
    message: "GitHub request failed",
    status: undefined,
  }
}

export function createOptionalStatus(status: number | undefined): { readonly status?: number } {
  return status === undefined ? {} : { status }
}

export function readUnknownArray(value: unknown): readonly unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

export function getRetryAfterMilliseconds(
  headers: GitHubTransportHeaders,
  attempt: number,
  now: Date,
): number {
  const retryAfter = headers["retry-after"]

  if (typeof retryAfter === "string" && /^\d+$/.test(retryAfter)) {
    return Number(retryAfter) * MILLISECONDS_PER_SECOND
  }

  if (typeof retryAfter === "string") {
    const retryAfterTimestamp = Date.parse(retryAfter)

    if (!Number.isNaN(retryAfterTimestamp)) {
      return Math.max(MINIMUM_POSITIVE_INTEGER, retryAfterTimestamp - now.getTime())
    }
  }

  const rateLimitReset = headers["x-ratelimit-reset"]

  if (typeof rateLimitReset === "string" && /^\d+$/.test(rateLimitReset)) {
    return Math.max(
      MINIMUM_POSITIVE_INTEGER,
      Number(rateLimitReset) * MILLISECONDS_PER_SECOND - now.getTime(),
    )
  }

  return (attempt + NEXT_ATTEMPT_INCREMENT) * MILLISECONDS_PER_SECOND
}

export function isRetryableStatus(
  status: number | undefined,
  headers: GitHubTransportHeaders,
): boolean {
  return (
    status === HTTP_RATE_LIMIT_STATUS ||
    (status === HTTP_FORBIDDEN_STATUS && hasRateLimitBackoffHeader(headers)) ||
    (status !== undefined && status >= HTTP_SERVER_ERROR_MINIMUM_STATUS)
  )
}

export function readNextPage(headers: GitHubTransportHeaders): number | undefined {
  const { link } = headers

  if (typeof link !== "string") {
    return undefined
  }

  const nextLink = link.split(",").find((entry) => entry.includes('rel="next"'))
  const pageMatch = nextLink?.match(/[?&]page=(\d+)/)

  return pageMatch?.[FIRST_CAPTURE_GROUP_INDEX] === undefined
    ? undefined
    : Number(pageMatch[FIRST_CAPTURE_GROUP_INDEX])
}

function hasRateLimitBackoffHeader(headers: GitHubTransportHeaders): boolean {
  return headers["retry-after"] !== undefined || headers["x-ratelimit-reset"] !== undefined
}

function normalizeHeaders(headers: GitHubTransportHeaders | undefined): GitHubTransportHeaders {
  if (headers === undefined) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
}
