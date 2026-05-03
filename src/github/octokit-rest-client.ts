import type {
  GitHubApiStatusEvent,
  GitHubRequestInput,
  GitHubRestClientOptions,
  GitHubRestResponse,
  GitHubTransport,
  GitHubTransportHeaders,
  GitHubTransportResponse,
} from "./types.js"
import { HTTP_NOT_MODIFIED_STATUS, HTTP_OK_STATUS } from "../constants.js"
import {
  INITIAL_ATTEMPT,
  NEXT_ATTEMPT_INCREMENT,
  createOptionalStatus,
  createRequestParams,
  getRetryAfterMilliseconds,
  isRetryableStatus,
  normalizeResponse,
  parseGitHubRequestError,
  readNextPage,
  readUnknownArray,
} from "./octokit-rest-client-helpers.js"
import { Octokit } from "@octokit/rest"
import { randomUUID } from "node:crypto"
import { setTimeout as sleepFor } from "node:timers/promises"

const DEFAULT_MAX_RETRIES = 2

interface RequestAttemptContext {
  readonly attempt: number
  readonly input: GitHubRequestInput
  readonly params: Record<string, unknown>
  readonly requestId: string
  readonly route: string
}

type ParsedRequestError = ReturnType<typeof parseGitHubRequestError>

/**
 * Keeps Octokit-specific request behavior at the GitHub adapter edge.
 *
 * The client owns cross-cutting REST concerns shared by future source fetchers:
 * authentication, conditional headers, retry/backoff, and lifecycle events that
 * the TUI can reduce into API status.
 */
export class OctokitRestClient {
  readonly #emitStatus: (event: GitHubApiStatusEvent) => void
  readonly #maxRetries: number
  readonly #now: () => Date
  readonly #sleep: (milliseconds: number) => Promise<void>
  readonly #transport: GitHubTransport

  constructor(options: GitHubRestClientOptions) {
    this.#emitStatus = options.onStatusEvent ?? noopStatusEventHandler
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    this.#now = options.now ?? (() => new Date())
    this.#sleep = options.sleep ?? sleepFor
    this.#transport =
      options.transport ??
      new Octokit({
        auth: options.token,
      })
  }

  /** Runs one REST call with adapter-level retry and lifecycle event handling. */
  async request<TData = unknown>(input: GitHubRequestInput): Promise<GitHubRestResponse<TData>> {
    const response = await this.#requestWithRetry<TData>(input)

    return response
  }

  async #requestWithRetry<TData>(input: GitHubRequestInput): Promise<GitHubRestResponse<TData>> {
    const requestId = randomUUID()
    const route = `${input.method} ${input.route}`
    const params = createRequestParams(input)

    // One request ID spans retries so status consumers can correlate a logical API call.
    this.#emitLifecycleEvent({
      kind: "request_started",
      method: input.method,
      requestId,
      route: input.route,
    })

    const response = await this.#attemptRequest<TData>({
      attempt: INITIAL_ATTEMPT,
      input,
      params,
      requestId,
      route,
    })

    return response
  }

  async #attemptRequest<TData>(context: RequestAttemptContext): Promise<GitHubRestResponse<TData>> {
    try {
      const response =
        context.input.paginate === true
          ? await this.#paginate<TData>(context.route, context.params, [])
          : await this.#transport.request<TData>(context.route, context.params)

      const normalized = normalizeResponse(response)
      this.#emitLifecycleEvent({
        kind: "request_succeeded",
        method: context.input.method,
        requestId: context.requestId,
        route: context.input.route,
        status: normalized.status,
      })

      return normalized
    } catch (error) {
      const response = await this.#handleRequestError<TData>(context, error)

      return response
    }
  }

  async #handleRequestError<TData>(
    context: RequestAttemptContext,
    error: unknown,
  ): Promise<GitHubRestResponse<TData>> {
    const parsedError = parseGitHubRequestError(error)

    if (parsedError.status === HTTP_NOT_MODIFIED_STATUS) {
      return this.#handleNotModified<TData>(context, parsedError)
    }

    const retryAfterMs = getRetryAfterMilliseconds(
      parsedError.headers,
      context.attempt,
      this.#now(),
    )
    const shouldRetry =
      context.attempt < this.#maxRetries &&
      isRetryableStatus(parsedError.status, parsedError.headers)

    if (shouldRetry) {
      const response = await this.#retryRequest<TData>(context, parsedError, retryAfterMs)

      return response
    }

    this.#emitFailedRequest(context, parsedError)
    throw error
  }

  #handleNotModified<TData>(
    context: RequestAttemptContext,
    parsedError: ParsedRequestError,
  ): GitHubRestResponse<TData> {
    // Octokit surfaces 304 as an error, but for conditional fetches it is a cache hit.
    this.#emitLifecycleEvent({
      kind: "request_succeeded",
      method: context.input.method,
      requestId: context.requestId,
      route: context.input.route,
      status: HTTP_NOT_MODIFIED_STATUS,
    })

    return {
      data: undefined,
      headers: parsedError.headers,
      notModified: true,
      status: HTTP_NOT_MODIFIED_STATUS,
    }
  }

  async #retryRequest<TData>(
    context: RequestAttemptContext,
    parsedError: ParsedRequestError,
    retryAfterMs: number,
  ): Promise<GitHubRestResponse<TData>> {
    // Retry events are emitted before sleeping so the UI can show backoff immediately.
    this.#emitLifecycleEvent({
      kind: "request_retried",
      message: parsedError.message,
      method: context.input.method,
      requestId: context.requestId,
      retryAfterMs,
      route: context.input.route,
      ...createOptionalStatus(parsedError.status),
    })
    await this.#sleep(retryAfterMs)

    const response = await this.#attemptRequest<TData>({
      ...context,
      attempt: context.attempt + NEXT_ATTEMPT_INCREMENT,
    })

    return response
  }

  #emitFailedRequest(context: RequestAttemptContext, parsedError: ParsedRequestError): void {
    this.#emitLifecycleEvent({
      kind: "request_failed",
      message: parsedError.message,
      method: context.input.method,
      requestId: context.requestId,
      route: context.input.route,
      ...createOptionalStatus(parsedError.status),
    })
  }

  async #paginate<TData>(
    route: string,
    params: Record<string, unknown>,
    previousData: unknown[],
    headers?: GitHubTransportHeaders,
  ): Promise<GitHubTransportResponse<TData>> {
    const response = await this.#transport.request<unknown>(route, params)
    const responseItems = readUnknownArray(response.data)
    const nextData = responseItems
      ? [...previousData, ...responseItems]
      : [...previousData, response.data]
    const nextPage = readNextPage(response.headers)

    if (nextPage !== undefined) {
      return this.#paginate<TData>(
        route,
        { ...params, page: nextPage },
        nextData,
        headers ?? response.headers,
      )
    }

    // The first page carries validators used by conditional polling for the list resource.
    return {
      data: nextData as TData,
      headers: headers ?? response.headers,
      status: HTTP_OK_STATUS,
    }
  }

  #emitLifecycleEvent(event: Omit<GitHubApiStatusEvent, "timestamp">): void {
    this.#emitStatus({
      ...event,
      timestamp: this.#now().toISOString(),
    })
  }
}

function noopStatusEventHandler(): undefined {
  return undefined
}
