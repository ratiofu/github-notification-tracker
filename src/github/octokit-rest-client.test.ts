import {
  RecordingTransport,
  ThrowingTransport,
  backoffAttemptCount,
  createBackoffOptions,
  createClient,
  createEventLog,
  createFailingSleep,
  createGitHubError,
  createPaginatedResponses,
  createRetryingClient,
  etagResponse,
  expectedConditionalRequests,
  expectedPaginatedRequests,
  fallbackBackoffMs,
  forbiddenStatus,
  genericForbiddenSleepError,
  httpDateBackoffMs,
  linkResponse,
  notModifiedStatus,
  okResponse,
  okStatus,
  pageOneId,
  pageTwoId,
  rateLimitResetEpochSeconds,
  recordSleepDurations,
  recordStatusEvents,
  retryAfterSeconds,
  retryAfterSecondsMs,
  secondIndex,
  serverErrorStatus,
  serviceUnavailableStatus,
  tooManyRequestsStatus,
} from "./octokit-rest-client.fixtures.js"
import { describe, expect, it } from "vitest"

describe("request parameters", () => {
  it("passes authenticated conditional parameters through the transport", async () => {
    const transport = new RecordingTransport([okResponse({ login: "octocat" })])
    const client = createClient(transport)

    const response = await client.request({
      etag: '"abc123"',
      lastModified: "Sat, 02 May 2026 12:00:00 GMT",
      method: "GET",
      parameters: { owner: "acme", repo: "widgets" },
      route: "/repos/{owner}/{repo}",
    })

    expect(response).toMatchObject({
      data: { login: "octocat" },
      notModified: false,
      status: okStatus,
    })
    expect(transport.requests).toStrictEqual(expectedConditionalRequests())
  })
})

describe("paginated cache validators", () => {
  it("preserves first-page cache validators", async () => {
    const transport = new RecordingTransport(createPaginatedResponses())
    const client = createClient(transport)

    const response = await client.request({
      method: "GET",
      paginate: true,
      route: "/repos/{owner}/{repo}/pulls",
    })

    expect(response).toMatchObject({
      data: [{ id: pageOneId }, { id: pageTwoId }],
      headers: { etag: '"first-page"' },
      status: okStatus,
    })
    expect(transport.requests).toStrictEqual(expectedPaginatedRequests())
  })
})

describe("pagination stop condition", () => {
  it("stops when the link header does not contain a next page", async () => {
    const transport = new RecordingTransport([
      linkResponse(
        [{ id: pageOneId }],
        '<https://api.github.com/repositories/1/events?page=1>; rel="prev"',
      ),
    ])
    const client = createClient(transport)

    await expect(
      client.request({
        method: "GET",
        paginate: true,
        route: "/repos/{owner}/{repo}/events",
      }),
    ).resolves.toMatchObject({ data: [{ id: pageOneId }] })
    expect(transport.requests).toHaveLength(backoffAttemptCount)
  })
})

describe("retry lifecycle", () => {
  it("emits lifecycle events before retrying retryable failures", async () => {
    const events = createEventLog()
    const sleepDurations: number[] = []
    const transport = new RecordingTransport([
      createGitHubError(serviceUnavailableStatus, "Unavailable", {
        "retry-after": retryAfterSeconds,
      }),
      etagResponse({ ok: true }, '"new"'),
    ])
    const client = createRetryingClient(transport, events, sleepDurations)

    await expectRequestSuccess(client)

    expect(sleepDurations).toStrictEqual([retryAfterSecondsMs])
    expect(events.map((event) => event.kind)).toStrictEqual([
      "request_started",
      "request_retried",
      "request_succeeded",
    ])
    expect(events[secondIndex]).toMatchObject({
      retryAfterMs: retryAfterSecondsMs,
      status: serviceUnavailableStatus,
    })
  })
})

describe("HTTP-date backoff", () => {
  it("uses HTTP-date retry-after values", async () => {
    const sleepDurations: number[] = []
    const transport = new RecordingTransport([
      createGitHubError(tooManyRequestsStatus, "Too many requests", {
        "retry-after": "Sat, 02 May 2026 12:00:05 GMT",
      }),
      okResponse({ ok: true }),
    ])
    const client = createClient(transport, createBackoffOptions(sleepDurations))

    await client.request({ method: "GET", route: "/http-date-backoff" })

    expect(sleepDurations).toStrictEqual([httpDateBackoffMs])
  })
})

describe("primary rate-limit backoff", () => {
  it("uses x-ratelimit-reset for primary rate limits", async () => {
    const events = createEventLog()
    const sleepDurations: number[] = []
    const transport = new RecordingTransport([
      createGitHubError(forbiddenStatus, "API rate limit exceeded", {
        "x-ratelimit-reset": rateLimitResetEpochSeconds,
      }),
      okResponse({ ok: true }),
    ])
    const client = createRetryingClient(transport, events, sleepDurations)

    await client.request({ method: "GET", route: "/primary-rate-limit" })

    expect(sleepDurations).toStrictEqual([httpDateBackoffMs])
    expect(events[secondIndex]).toMatchObject({
      kind: "request_retried",
      retryAfterMs: httpDateBackoffMs,
      status: forbiddenStatus,
    })
  })
})

describe("fallback backoff", () => {
  it("falls back to exponential backoff when retry-after is not parseable", async () => {
    const sleepDurations: number[] = []
    const transport = new RecordingTransport([
      createGitHubError(tooManyRequestsStatus, "Too many requests", {
        "retry-after": "not-a-date",
      }),
      okResponse({ ok: true }),
    ])
    const client = createClient(transport, createBackoffOptions(sleepDurations))

    await client.request({ method: "GET", route: "/fallback-backoff" })

    expect(sleepDurations).toStrictEqual([fallbackBackoffMs])
  })
})

describe("generic forbidden failures", () => {
  it("does not retry generic forbidden responses without backoff headers", async () => {
    const events = createEventLog()
    const transport = new RecordingTransport([createGitHubError(forbiddenStatus, "Forbidden")])
    const client = createClient(transport, {
      maxRetries: backoffAttemptCount,
      onStatusEvent: recordStatusEvents(events),
      sleep: createFailingSleep(genericForbiddenSleepError),
    })

    await expect(client.request({ method: "GET", route: "/forbidden" })).rejects.toMatchObject({
      message: "Forbidden",
      status: forbiddenStatus,
    })
    expect(transport.requests).toHaveLength(backoffAttemptCount)
    expect(events.map((event) => event.kind)).toStrictEqual(["request_started", "request_failed"])
  })
})

describe("non-error failures", () => {
  it("emits failure events for non-error thrown values", async () => {
    const events = createEventLog()
    const client = createClient(new ThrowingTransport("broken transport"), {
      onStatusEvent: recordStatusEvents(events),
    })

    await expect(client.request({ method: "GET", route: "/broken" })).rejects.toBe(
      "broken transport",
    )
    expect(events).toStrictEqual([
      expect.objectContaining({ kind: "request_started" }),
      expect.objectContaining({
        kind: "request_failed",
        message: "GitHub request failed",
      }),
    ])
  })
})

describe("exhausted retries", () => {
  it("emits failure events after retry attempts are exhausted", async () => {
    const events = createEventLog()
    const transport = new RecordingTransport([
      createGitHubError(serverErrorStatus, "Server error"),
      createGitHubError(serverErrorStatus, "Server error"),
    ])
    const client = createClient(transport, {
      maxRetries: backoffAttemptCount,
      onStatusEvent: recordStatusEvents(events),
      sleep: recordSleepDurations([]),
    })

    await expect(client.request({ method: "GET", route: "/failing" })).rejects.toMatchObject({
      message: "Server error",
      status: serverErrorStatus,
    })
    expect(events.map((event) => event.kind)).toStrictEqual([
      "request_started",
      "request_retried",
      "request_failed",
    ])
  })
})

describe("cache hits", () => {
  it("treats conditional 304 responses as successful cache hits", async () => {
    const events = createEventLog()
    const transport = new RecordingTransport([
      createGitHubError(notModifiedStatus, "Not modified", { etag: '"old"' }),
    ])
    const client = createClient(transport, { onStatusEvent: recordStatusEvents(events) })

    await expect(client.request({ method: "GET", route: "/cached" })).resolves.toStrictEqual({
      data: undefined,
      headers: { etag: '"old"' },
      notModified: true,
      status: notModifiedStatus,
    })
    expect(events.map((event) => event.kind)).toStrictEqual([
      "request_started",
      "request_succeeded",
    ])
  })
})

async function expectRequestSuccess(client: ReturnType<typeof createClient>): Promise<void> {
  await expect(client.request({ method: "GET", route: "/rate-limited" })).resolves.toMatchObject({
    data: { ok: true },
    headers: { etag: '"new"' },
    status: okStatus,
  })
}
