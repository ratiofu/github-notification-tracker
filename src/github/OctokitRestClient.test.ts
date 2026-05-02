import { describe, expect, it } from "vitest";

import { OctokitRestClient } from "./OctokitRestClient.js";
import type { GitHubApiStatusEvent, GitHubTransport, GitHubTransportResponse } from "./types.js";

describe("OctokitRestClient", () => {
  it("passes PAT-authenticated conditional request parameters through the transport", async () => {
    const transport = new RecordingTransport([
      { data: { login: "octocat" }, headers: {}, status: 200 },
    ]);
    const client = new OctokitRestClient({
      token: "github-token",
      transport,
    });

    const response = await client.request({
      etag: '"abc123"',
      lastModified: "Sat, 02 May 2026 12:00:00 GMT",
      method: "GET",
      parameters: { owner: "acme", repo: "widgets" },
      route: "/repos/{owner}/{repo}",
    });

    expect(response).toMatchObject({
      data: { login: "octocat" },
      notModified: false,
      status: 200,
    });
    expect(transport.requests).toEqual([
      {
        params: {
          headers: {
            "if-modified-since": "Sat, 02 May 2026 12:00:00 GMT",
            "if-none-match": '"abc123"',
          },
          owner: "acme",
          per_page: 100,
          repo: "widgets",
          request: {
            signal: undefined,
          },
        },
        route: "GET /repos/{owner}/{repo}",
      },
    ]);
  });

  it("paginates through request calls while preserving first-page cache validators", async () => {
    const transport = new RecordingTransport([
      {
        data: [{ id: 1 }],
        headers: {
          etag: '"first-page"',
          link: '<https://api.github.com/repositories/1/events?page=2>; rel="next"',
        },
        status: 200,
      },
      {
        data: [{ id: 2 }],
        headers: { etag: '"second-page"' },
        status: 200,
      },
    ]);
    const client = new OctokitRestClient({
      token: "github-token",
      transport,
    });

    const response = await client.request({
      method: "GET",
      paginate: true,
      route: "/repos/{owner}/{repo}/pulls",
    });

    expect(response).toMatchObject({
      data: [{ id: 1 }, { id: 2 }],
      headers: {
        etag: '"first-page"',
      },
      status: 200,
    });
    expect(transport.requests).toEqual([
      {
        params: {
          headers: {},
          per_page: 100,
          request: {
            signal: undefined,
          },
        },
        route: "GET /repos/{owner}/{repo}/pulls",
      },
      {
        params: {
          headers: {},
          page: 2,
          per_page: 100,
          request: {
            signal: undefined,
          },
        },
        route: "GET /repos/{owner}/{repo}/pulls",
      },
    ]);
  });

  it("emits lifecycle events and backs off before retrying retryable failures", async () => {
    const events: GitHubApiStatusEvent[] = [];
    const sleepDurations: number[] = [];
    const transport = new RecordingTransport([
      createGitHubError(503, "Unavailable", { "retry-after": "2" }),
      { data: { ok: true }, headers: { etag: '"new"' }, status: 200 },
    ]);
    const client = new OctokitRestClient({
      maxRetries: 1,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
      onStatusEvent: (event) => events.push(event),
      sleep: async (milliseconds) => {
        sleepDurations.push(milliseconds);
      },
      token: "github-token",
      transport,
    });

    await expect(
      client.request({
        method: "GET",
        route: "/rate-limited",
      }),
    ).resolves.toMatchObject({
      data: { ok: true },
      headers: { etag: '"new"' },
      status: 200,
    });

    expect(sleepDurations).toEqual([2000]);
    expect(events.map((event) => event.kind)).toEqual([
      "request_started",
      "request_retried",
      "request_succeeded",
    ]);
    expect(events[1]).toMatchObject({
      retryAfterMs: 2000,
      status: 503,
    });
  });

  it("uses HTTP-date retry-after values for backoff", async () => {
    const sleepDurations: number[] = [];
    const transport = new RecordingTransport([
      createGitHubError(429, "Too many requests", {
        "retry-after": "Sat, 02 May 2026 12:00:05 GMT",
      }),
      { data: { ok: true }, headers: {}, status: 200 },
    ]);
    const client = new OctokitRestClient({
      maxRetries: 1,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
      sleep: async (milliseconds) => {
        sleepDurations.push(milliseconds);
      },
      token: "github-token",
      transport,
    });

    await client.request({
      method: "GET",
      route: "/http-date-backoff",
    });

    expect(sleepDurations).toEqual([5000]);
  });

  it("uses x-ratelimit-reset for GitHub primary rate-limit backoff", async () => {
    const events: GitHubApiStatusEvent[] = [];
    const sleepDurations: number[] = [];
    const transport = new RecordingTransport([
      createGitHubError(403, "API rate limit exceeded", {
        "x-ratelimit-reset": "1777723205",
      }),
      { data: { ok: true }, headers: {}, status: 200 },
    ]);
    const client = new OctokitRestClient({
      maxRetries: 1,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
      onStatusEvent: (event) => events.push(event),
      sleep: async (milliseconds) => {
        sleepDurations.push(milliseconds);
      },
      token: "github-token",
      transport,
    });

    await client.request({
      method: "GET",
      route: "/primary-rate-limit",
    });

    expect(sleepDurations).toEqual([5000]);
    expect(events[1]).toMatchObject({
      kind: "request_retried",
      retryAfterMs: 5000,
      status: 403,
    });
  });

  it("falls back to exponential backoff when retry-after is not parseable", async () => {
    const sleepDurations: number[] = [];
    const transport = new RecordingTransport([
      createGitHubError(429, "Too many requests", {
        "retry-after": "not-a-date",
      }),
      { data: { ok: true }, headers: {}, status: 200 },
    ]);
    const client = new OctokitRestClient({
      maxRetries: 1,
      now: () => new Date("2026-05-02T12:00:00.000Z"),
      sleep: async (milliseconds) => {
        sleepDurations.push(milliseconds);
      },
      token: "github-token",
      transport,
    });

    await client.request({
      method: "GET",
      route: "/fallback-backoff",
    });

    expect(sleepDurations).toEqual([1000]);
  });

  it("stops pagination when the link header does not contain a next page", async () => {
    const transport = new RecordingTransport([
      {
        data: [{ id: 1 }],
        headers: {
          link: '<https://api.github.com/repositories/1/events?page=1>; rel="prev"',
        },
        status: 200,
      },
    ]);
    const client = new OctokitRestClient({
      token: "github-token",
      transport,
    });

    await expect(
      client.request({
        method: "GET",
        paginate: true,
        route: "/repos/{owner}/{repo}/events",
      }),
    ).resolves.toMatchObject({
      data: [{ id: 1 }],
    });
    expect(transport.requests).toHaveLength(1);
  });

  it("does not retry generic forbidden responses without rate-limit backoff headers", async () => {
    const events: GitHubApiStatusEvent[] = [];
    const transport = new RecordingTransport([createGitHubError(403, "Forbidden")]);
    const client = new OctokitRestClient({
      maxRetries: 1,
      onStatusEvent: (event) => events.push(event),
      sleep: async () => {
        throw new Error("generic 403 should not sleep before retry");
      },
      token: "github-token",
      transport,
    });

    await expect(
      client.request({
        method: "GET",
        route: "/forbidden",
      }),
    ).rejects.toMatchObject({
      message: "Forbidden",
      status: 403,
    });

    expect(transport.requests).toHaveLength(1);
    expect(events.map((event) => event.kind)).toEqual(["request_started", "request_failed"]);
  });

  it("emits failure events for non-error thrown values", async () => {
    const events: GitHubApiStatusEvent[] = [];
    const transport = new ThrowingTransport("broken transport");
    const client = new OctokitRestClient({
      onStatusEvent: (event) => events.push(event),
      token: "github-token",
      transport,
    });

    await expect(
      client.request({
        method: "GET",
        route: "/broken",
      }),
    ).rejects.toBe("broken transport");
    expect(events).toEqual([
      expect.objectContaining({
        kind: "request_started",
      }),
      expect.objectContaining({
        kind: "request_failed",
        message: "GitHub request failed",
      }),
    ]);
  });

  it("treats conditional 304 responses as successful cache hits", async () => {
    const events: GitHubApiStatusEvent[] = [];
    const transport = new RecordingTransport([
      createGitHubError(304, "Not modified", { etag: '"old"' }),
    ]);
    const client = new OctokitRestClient({
      onStatusEvent: (event) => events.push(event),
      token: "github-token",
      transport,
    });

    await expect(
      client.request({
        method: "GET",
        route: "/cached",
      }),
    ).resolves.toEqual({
      data: undefined,
      headers: { etag: '"old"' },
      notModified: true,
      status: 304,
    });
    expect(events.map((event) => event.kind)).toEqual(["request_started", "request_succeeded"]);
  });

  it("emits failure events after retry attempts are exhausted", async () => {
    const events: GitHubApiStatusEvent[] = [];
    const transport = new RecordingTransport([
      createGitHubError(500, "Server error"),
      createGitHubError(500, "Server error"),
    ]);
    const client = new OctokitRestClient({
      maxRetries: 1,
      onStatusEvent: (event) => events.push(event),
      sleep: async () => undefined,
      token: "github-token",
      transport,
    });

    await expect(
      client.request({
        method: "GET",
        route: "/failing",
      }),
    ).rejects.toMatchObject({
      message: "Server error",
      status: 500,
    });
    expect(events.map((event) => event.kind)).toEqual([
      "request_started",
      "request_retried",
      "request_failed",
    ]);
  });
});

class RecordingTransport implements GitHubTransport {
  readonly requests: Array<{ params: Record<string, unknown>; route: string }> = [];
  readonly #responses: unknown[];

  constructor(responses: unknown[]) {
    this.#responses = responses;
  }

  async request<TData>(
    route: string,
    params: Record<string, unknown>,
  ): Promise<GitHubTransportResponse<TData>> {
    this.requests.push({ params, route });
    const response = this.#responses.shift();

    if (response instanceof Error) {
      throw response;
    }

    return response as GitHubTransportResponse<TData>;
  }
}

class ThrowingTransport implements GitHubTransport {
  readonly #error: unknown;

  constructor(error: unknown) {
    this.#error = error;
  }

  async request<TData>(): Promise<GitHubTransportResponse<TData>> {
    throw this.#error;
  }
}

function createGitHubError(
  status: number,
  message: string,
  headers: Record<string, string> = {},
): Error {
  const error = new Error(message) as Error & {
    response: {
      headers: Record<string, string>;
    };
    status: number;
  };
  error.status = status;
  error.response = { headers };

  return error;
}
