import { randomUUID } from "node:crypto";

import { Octokit } from "@octokit/rest";

import type {
  GitHubApiStatusEvent,
  GitHubRequestInput,
  GitHubRestClientOptions,
  GitHubRestResponse,
  GitHubTransport,
  GitHubTransportHeaders,
  GitHubTransportResponse,
} from "./types.js";

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_PER_PAGE = 100;

/**
 * Keeps Octokit-specific request behavior at the GitHub adapter edge.
 *
 * The client owns cross-cutting REST concerns shared by future source fetchers:
 * authentication, conditional headers, retry/backoff, and lifecycle events that
 * the TUI can reduce into API status.
 */
export class OctokitRestClient {
  readonly #emitStatus: (event: GitHubApiStatusEvent) => void;
  readonly #maxRetries: number;
  readonly #now: () => Date;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #transport: GitHubTransport;

  constructor(options: GitHubRestClientOptions) {
    this.#emitStatus = options.onStatusEvent ?? (() => undefined);
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#now = options.now ?? (() => new Date());
    this.#sleep =
      options.sleep ??
      ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.#transport =
      options.transport ??
      new Octokit({
        auth: options.token,
      });
  }

  /** Runs one REST call with adapter-level retry and lifecycle event handling. */
  async request<TData = unknown>(input: GitHubRequestInput): Promise<GitHubRestResponse<TData>> {
    return await this.#requestWithRetry<TData>(input);
  }

  async #requestWithRetry<TData>(input: GitHubRequestInput): Promise<GitHubRestResponse<TData>> {
    const requestId = randomUUID();
    const route = `${input.method} ${input.route}`;
    const params = createRequestParams(input);

    // One request ID spans retries so status consumers can correlate a logical API call.
    this.#emitLifecycleEvent({
      kind: "request_started",
      method: input.method,
      requestId,
      route: input.route,
    });

    return await this.#attemptRequest<TData>(input, route, params, requestId, 0);
  }

  async #attemptRequest<TData>(
    input: GitHubRequestInput,
    route: string,
    params: Record<string, unknown>,
    requestId: string,
    attempt: number,
  ): Promise<GitHubRestResponse<TData>> {
    try {
      const response = input.paginate
        ? await this.#paginate<TData>(route, params, [])
        : await this.#transport.request<TData>(route, params);

      const normalized = normalizeResponse(response);
      this.#emitLifecycleEvent({
        kind: "request_succeeded",
        method: input.method,
        requestId,
        route: input.route,
        status: normalized.status,
      });

      return normalized;
    } catch (error) {
      return await this.#handleRequestError<TData>(input, route, params, requestId, attempt, error);
    }
  }

  async #handleRequestError<TData>(
    input: GitHubRequestInput,
    route: string,
    params: Record<string, unknown>,
    requestId: string,
    attempt: number,
    error: unknown,
  ): Promise<GitHubRestResponse<TData>> {
    const parsedError = parseGitHubRequestError(error);

    // Octokit surfaces 304 as an error, but for conditional fetches it is a cache hit.
    if (parsedError.status === 304) {
      this.#emitLifecycleEvent({
        kind: "request_succeeded",
        method: input.method,
        requestId,
        route: input.route,
        status: 304,
      });

      return {
        data: undefined,
        headers: parsedError.headers,
        notModified: true,
        status: 304,
      };
    }

    const retryAfterMs = getRetryAfterMilliseconds(parsedError.headers, attempt, this.#now());
    const shouldRetry =
      attempt < this.#maxRetries && isRetryableStatus(parsedError.status, parsedError.headers);

    if (shouldRetry) {
      // Retry events are emitted before sleeping so the UI can show backoff immediately.
      this.#emitLifecycleEvent({
        kind: "request_retried",
        message: parsedError.message,
        method: input.method,
        requestId,
        retryAfterMs,
        route: input.route,
        ...createOptionalStatus(parsedError.status),
      });
      await this.#sleep(retryAfterMs);

      return await this.#attemptRequest<TData>(input, route, params, requestId, attempt + 1);
    }

    this.#emitLifecycleEvent({
      kind: "request_failed",
      message: parsedError.message,
      method: input.method,
      requestId,
      route: input.route,
      ...createOptionalStatus(parsedError.status),
    });
    throw error;
  }

  async #paginate<TData>(
    route: string,
    params: Record<string, unknown>,
    previousData: unknown[],
    headers?: GitHubTransportHeaders,
  ): Promise<GitHubTransportResponse<TData>> {
    const response = await this.#transport.request<unknown>(route, params);
    const nextData = Array.isArray(response.data)
      ? [...previousData, ...response.data]
      : [...previousData, response.data];
    const nextPage = readNextPage(response.headers);

    if (nextPage !== undefined) {
      return await this.#paginate<TData>(
        route,
        { ...params, page: nextPage },
        nextData,
        headers ?? response.headers,
      );
    }

    // The first page carries validators used by conditional polling for the list resource.
    return {
      data: nextData as TData,
      headers: headers ?? response.headers,
      status: 200,
    };
  }

  #emitLifecycleEvent(event: Omit<GitHubApiStatusEvent, "timestamp">): void {
    this.#emitStatus({
      ...event,
      timestamp: this.#now().toISOString(),
    });
  }
}

/** Builds Octokit request parameters while preserving caller-supplied conditional validators. */
function createRequestParams(input: GitHubRequestInput): Record<string, unknown> {
  const headers: Record<string, string> = {
    ...input.headers,
  };

  if (input.etag !== undefined) {
    headers["if-none-match"] = input.etag;
  }

  if (input.lastModified !== undefined) {
    headers["if-modified-since"] = input.lastModified;
  }

  return {
    ...input.parameters,
    headers,
    per_page: input.perPage ?? DEFAULT_PER_PAGE,
    request: {
      signal: input.signal,
    },
  };
}

/** Normalizes response headers for case-insensitive downstream cache validator lookups. */
function normalizeResponse<TData>(
  response: GitHubTransportResponse<TData>,
): GitHubRestResponse<TData> {
  return {
    data: response.data,
    headers: normalizeHeaders(response.headers),
    notModified: false,
    status: response.status,
  };
}

interface ParsedGitHubRequestError {
  readonly headers: GitHubTransportHeaders;
  readonly message: string;
  readonly status: number | undefined;
}

function parseGitHubRequestError(error: unknown): ParsedGitHubRequestError {
  if (typeof error === "object" && error !== null) {
    const errorRecord = error as {
      readonly message?: unknown;
      readonly response?: {
        readonly headers?: GitHubTransportHeaders;
      };
      readonly status?: unknown;
    };

    return {
      headers: normalizeHeaders(errorRecord.response?.headers),
      message:
        typeof errorRecord.message === "string" ? errorRecord.message : "GitHub request failed",
      status: typeof errorRecord.status === "number" ? errorRecord.status : undefined,
    };
  }

  return {
    headers: {},
    message: "GitHub request failed",
    status: undefined,
  };
}

function createOptionalStatus(status: number | undefined): { readonly status?: number } {
  return status === undefined ? {} : { status };
}

function getRetryAfterMilliseconds(
  headers: GitHubTransportHeaders,
  attempt: number,
  now: Date,
): number {
  const retryAfter = headers["retry-after"];

  if (typeof retryAfter === "string" && /^\d+$/.test(retryAfter)) {
    return Number(retryAfter) * 1000;
  }

  if (typeof retryAfter === "string") {
    const retryAfterTimestamp = Date.parse(retryAfter);

    if (!Number.isNaN(retryAfterTimestamp)) {
      return Math.max(0, retryAfterTimestamp - now.getTime());
    }
  }

  const rateLimitReset = headers["x-ratelimit-reset"];

  if (typeof rateLimitReset === "string" && /^\d+$/.test(rateLimitReset)) {
    return Math.max(0, Number(rateLimitReset) * 1000 - now.getTime());
  }

  return (attempt + 1) * 1000;
}

function isRetryableStatus(status: number | undefined, headers: GitHubTransportHeaders): boolean {
  return (
    status === 429 ||
    (status === 403 && hasRateLimitBackoffHeader(headers)) ||
    (status !== undefined && status >= 500)
  );
}

function hasRateLimitBackoffHeader(headers: GitHubTransportHeaders): boolean {
  return headers["retry-after"] !== undefined || headers["x-ratelimit-reset"] !== undefined;
}

function normalizeHeaders(headers: GitHubTransportHeaders | undefined): GitHubTransportHeaders {
  if (headers === undefined) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function readNextPage(headers: GitHubTransportHeaders): number | undefined {
  const link = headers.link;

  if (typeof link !== "string") {
    return undefined;
  }

  const nextLink = link.split(",").find((entry) => entry.includes('rel="next"'));
  const pageMatch = nextLink?.match(/[?&]page=(\d+)/);

  return pageMatch?.[1] === undefined ? undefined : Number(pageMatch[1]);
}
