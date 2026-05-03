import type {
  GitHubApiStatusEvent,
  GitHubRestClientOptions,
  GitHubTransport,
  GitHubTransportResponse,
} from "./types.js"
import { OctokitRestClient } from "./octokit-rest-client.js"

export const backoffAttemptCount = 1
export const defaultPageSize = 100
export const fallbackBackoffMs = 1000
export const firstIndex = 0
export const forbiddenStatus = 403
export const genericForbiddenSleepError = "generic 403 must not sleep before retry"
export const githubToken = "github-token"
export const httpDateBackoffMs = 5000
export const notModifiedStatus = 304
export const okStatus = 200
export const pageOneId = 1
export const pageTwoId = 2
export const rateLimitResetEpochSeconds = "1777723205"
export const retryAfterSeconds = "2"
export const retryAfterSecondsMs = 2000
export const secondIndex = 1
export const serverErrorStatus = 500
export const serviceUnavailableStatus = 503
export const tooManyRequestsStatus = 429

const nowIso = "2026-05-02T12:00:00.000Z"

export type StatusEventLog = GitHubApiStatusEvent[]

export function createClient(
  transport: GitHubTransport,
  options: Partial<GitHubRestClientOptions> = {},
): OctokitRestClient {
  return new OctokitRestClient({
    token: githubToken,
    transport,
    ...options,
  })
}

export function createFixedNow(): Date {
  return new Date(nowIso)
}

export function createEventLog(): StatusEventLog {
  return []
}

export function createPaginatedResponses(): readonly unknown[] {
  return [
    {
      data: [{ id: pageOneId }],
      headers: {
        etag: '"first-page"',
        link: '<https://api.github.com/repositories/1/events?page=2>; rel="next"',
      },
      status: okStatus,
    },
    etagResponse([{ id: pageTwoId }], '"second-page"'),
  ]
}

export function expectedConditionalRequests(): readonly unknown[] {
  return [
    {
      params: {
        headers: {
          "if-modified-since": "Sat, 02 May 2026 12:00:00 GMT",
          "if-none-match": '"abc123"',
        },
        owner: "acme",
        per_page: defaultPageSize,
        repo: "widgets",
        request: {
          signal: undefined,
        },
      },
      route: "GET /repos/{owner}/{repo}",
    },
  ]
}

export function expectedPaginatedRequests(): readonly unknown[] {
  return [
    {
      params: {
        headers: {},
        per_page: defaultPageSize,
        request: {
          signal: undefined,
        },
      },
      route: "GET /repos/{owner}/{repo}/pulls",
    },
    {
      params: {
        headers: {},
        page: pageTwoId,
        per_page: defaultPageSize,
        request: {
          signal: undefined,
        },
      },
      route: "GET /repos/{owner}/{repo}/pulls",
    },
  ]
}

export function createBackoffOptions(sleepDurations: number[]): Partial<GitHubRestClientOptions> {
  return {
    maxRetries: backoffAttemptCount,
    now: createFixedNow,
    sleep: recordSleepDurations(sleepDurations),
  }
}

export function createRetryingClient(
  transport: GitHubTransport,
  events: StatusEventLog,
  sleepDurations: number[],
): OctokitRestClient {
  return createClient(transport, {
    ...createBackoffOptions(sleepDurations),
    onStatusEvent: recordStatusEvents(events),
  })
}

export function recordStatusEvents(
  events: GitHubApiStatusEvent[],
): (event: GitHubApiStatusEvent) => void {
  return (event) => {
    events.push(event)
  }
}

export function recordSleepDurations(durations: number[]): (milliseconds: number) => Promise<void> {
  return async (milliseconds) => {
    durations.push(milliseconds)
    await Promise.resolve()
  }
}

export function createFailingSleep(message: string): () => Promise<void> {
  return async () => {
    await Promise.resolve()
    throw new Error(message)
  }
}

export function okResponse<TData>(data: TData): GitHubTransportResponse<TData> {
  return { data, headers: {}, status: okStatus }
}

export function etagResponse<TData>(data: TData, etag: string): GitHubTransportResponse<TData> {
  return { data, headers: { etag }, status: okStatus }
}

export function linkResponse<TData>(data: TData, link: string): GitHubTransportResponse<TData> {
  return { data, headers: { link }, status: okStatus }
}

export class RecordingTransport implements GitHubTransport {
  readonly requests: { readonly params: Record<string, unknown>; readonly route: string }[] = []
  readonly #responses: unknown[]

  constructor(responses: readonly unknown[]) {
    this.#responses = [...responses]
  }

  async request<TData>(
    route: string,
    params: Record<string, unknown>,
  ): Promise<GitHubTransportResponse<TData>> {
    this.requests.push({ params, route })
    const response = this.#responses.shift()

    if (response instanceof Error) {
      await Promise.resolve()
      throw response
    }

    await Promise.resolve()

    return response as GitHubTransportResponse<TData>
  }
}

export class ThrowingTransport implements GitHubTransport {
  readonly #error: unknown

  constructor(error: unknown) {
    this.#error = error
  }

  async request<TData>(): Promise<GitHubTransportResponse<TData>> {
    await Promise.resolve()
    throw this.#error
  }
}

export function createGitHubError(
  status: number,
  message: string,
  headers: Record<string, string> = {},
): Error {
  const error = new Error(message) as Error & {
    response: {
      headers: Record<string, string>
    }
    status: number
  }
  error.status = status
  error.response = { headers }

  return error
}
