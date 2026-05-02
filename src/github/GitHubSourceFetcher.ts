import { z } from "zod";

import {
  GitHubPullRequestSourceSchema,
  GitHubSourcePayloadWrapperSchema,
  type GitHubEntityId,
  type GitHubSourcePayloadWrapper,
} from "../domain/index.js";
import type {
  GitHubCheckRunFetchInput,
  GitHubFetchedAt,
  GitHubGenericSourceFetchResult,
  GitHubPullRequestFetchInput,
  GitHubPullRequestSourceFetchResult,
  GitHubRepoFetchInput,
  GitHubSourceFetcherOptions,
  GitHubTeamMemberFetchInput,
} from "./source-types.js";
import type { GitHubRestResponse } from "./types.js";

const JsonArraySchema = z.array(z.json());

/**
 * Raw collection envelope from GitHub's check-runs-for-ref endpoint.
 *
 * Source: https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference
 */
const CheckRunsApiPayloadSchema = z.looseObject({
  check_runs: z.array(z.json()),
  total_count: z.number().int().nonnegative(),
});

/**
 * Raw subset returned by GitHub's "Get a pull request" REST endpoint.
 *
 * Source: https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request
 */
const PullRequestApiPayloadSchema = z.looseObject({
  head: z.object({
    sha: z.string().min(1),
  }),
  html_url: z.url(),
  id: z.number().int().nonnegative(),
  number: z.number().int().positive(),
  state: z.enum(["open", "closed"]),
  updated_at: z.iso.datetime({ offset: true }),
  url: z.url(),
});

/**
 * Fetches raw GitHub source records and validates only the local wrapper shape.
 *
 * The fetcher keeps API routing separate from later mapping policy: callers decide which
 * PRs need detail refreshes, while this class returns raw payload wrappers for those calls.
 */
export class GitHubSourceFetcher {
  readonly #client: GitHubSourceFetcherOptions["client"];
  readonly #now: () => Date;

  constructor(options: GitHubSourceFetcherOptions) {
    this.#client = options.client;
    this.#now = options.now ?? (() => new Date());
  }

  /** Poll entry point: repository events are read before deciding which PRs need details. */
  async fetchRepositoryActivity(
    input: GitHubRepoFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    return await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/events",
      sourceKind: "timeline_event",
    });
  }

  async fetchPullRequest(
    input: GitHubPullRequestFetchInput,
  ): Promise<GitHubPullRequestSourceFetchResult> {
    const response = await this.#request({
      input,
      route: "/repos/{owner}/{repo}/pulls/{pull_number}",
      parameters: {
        pull_number: input.pullRequestNumber,
      },
    });

    if (response.notModified) {
      return createResult(response, []);
    }

    const payload = PullRequestApiPayloadSchema.parse(response.data);
    const source = GitHubPullRequestSourceSchema.parse({
      apiUrl: payload.url,
      entityId: payload.id,
      fetchedAt: this.#fetchedAt(),
      headSha: payload.head.sha,
      payload,
      pullRequestNumber: payload.number,
      repo: input.repo,
      sourceKind: "pull_request",
      state: payload.state,
      updatedAt: payload.updated_at,
    });

    return createResult(response, [source]);
  }

  async fetchPullRequestTimeline(
    input: GitHubPullRequestFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    return await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/issues/{issue_number}/timeline",
      sourceKind: "timeline_event",
      parameters: {
        issue_number: input.pullRequestNumber,
      },
    });
  }

  async fetchIssueComments(
    input: GitHubPullRequestFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    return await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/issues/{issue_number}/comments",
      sourceKind: "issue_comment",
      parameters: {
        issue_number: input.pullRequestNumber,
      },
    });
  }

  async fetchReviewComments(
    input: GitHubPullRequestFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    return await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/pulls/{pull_number}/comments",
      sourceKind: "review_comment",
      parameters: {
        pull_number: input.pullRequestNumber,
      },
    });
  }

  async fetchReviews(input: GitHubPullRequestFetchInput): Promise<GitHubGenericSourceFetchResult> {
    return await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      sourceKind: "review",
      parameters: {
        pull_number: input.pullRequestNumber,
      },
    });
  }

  async fetchCheckRuns(input: GitHubCheckRunFetchInput): Promise<GitHubGenericSourceFetchResult> {
    const response = await this.#request<unknown>({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/commits/{ref}/check-runs",
      parameters: {
        ref: input.headSha,
      },
    });

    if (response.notModified) {
      return createResult(response, []);
    }

    const payload = CheckRunsApiPayloadSchema.parse(response.data);
    const fetchedAt = this.#fetchedAt();
    const sources = payload.check_runs.map((checkRun) =>
      createSourceWrapper({
        fetchedAt,
        payload: checkRun,
        repo: input.repo,
        sourceKind: "check_run",
      }),
    );

    return createResult(response, sources);
  }

  async fetchRepositoryTeams(input: GitHubRepoFetchInput): Promise<GitHubGenericSourceFetchResult> {
    return await this.#fetchSourceList({
      input,
      paginate: true,
      route: "/repos/{owner}/{repo}/teams",
      sourceKind: "team",
    });
  }

  async fetchTeamMembers(
    input: GitHubTeamMemberFetchInput,
  ): Promise<GitHubGenericSourceFetchResult> {
    const response = await this.#client.request<unknown[]>({
      method: "GET",
      paginate: true,
      parameters: {
        org: input.org,
        team_slug: input.teamSlug,
      },
      route: "/orgs/{org}/teams/{team_slug}/members",
      ...createCacheValidatorRequestFields(input.cache),
      ...createOptionalPerPage(input.perPage),
      ...createOptionalAbortSignal(input.signal),
    });

    if (response.notModified) {
      return createResult(response, []);
    }

    const payloads = JsonArraySchema.parse(response.data);
    const fetchedAt = this.#fetchedAt();
    const sources = payloads.map((payload) =>
      createSourceWrapper({
        fetchedAt,
        payload,
        repo: input.repo,
        sourceKind: "team_member",
      }),
    );

    return createResult(response, sources);
  }

  async #fetchSourceList(options: {
    readonly input: GitHubRepoFetchInput;
    readonly paginate: boolean;
    readonly parameters?: Record<string, unknown>;
    readonly route: string;
    readonly sourceKind: GitHubSourcePayloadWrapper["sourceKind"];
  }): Promise<GitHubGenericSourceFetchResult> {
    const response = await this.#request({
      input: options.input,
      paginate: options.paginate,
      route: options.route,
      ...createOptionalParameters(options.parameters),
    });

    if (response.notModified) {
      return createResult(response, []);
    }

    const payloads = JsonArraySchema.parse(response.data);
    const fetchedAt = this.#fetchedAt();
    const sources = payloads.map((payload) =>
      createSourceWrapper({
        fetchedAt,
        payload,
        repo: options.input.repo,
        sourceKind: options.sourceKind,
      }),
    );

    return createResult(response, sources);
  }

  async #request<TData>(options: {
    readonly input: GitHubRepoFetchInput;
    readonly paginate?: boolean;
    readonly parameters?: Record<string, unknown>;
    readonly route: string;
  }): Promise<GitHubRestResponse<TData>> {
    const { owner, repo } = splitRepoName(options.input.repo);

    return await this.#client.request<TData>({
      method: "GET",
      parameters: {
        ...options.parameters,
        owner,
        repo,
      },
      route: options.route,
      ...createCacheValidatorRequestFields(options.input.cache),
      ...createOptionalPaginate(options.paginate),
      ...createOptionalPerPage(options.input.perPage),
      ...createOptionalAbortSignal(options.input.signal),
    });
  }

  #fetchedAt(): GitHubFetchedAt {
    return this.#now().toISOString();
  }
}

function createSourceWrapper(input: {
  readonly fetchedAt: GitHubFetchedAt;
  readonly payload: unknown;
  readonly repo: string;
  readonly sourceKind: GitHubSourcePayloadWrapper["sourceKind"];
}): GitHubSourcePayloadWrapper {
  const payload = z.json().parse(input.payload);
  const payloadRecord = typeof payload === "object" && payload !== null ? payload : {};

  return GitHubSourcePayloadWrapperSchema.parse({
    apiUrl: readString(payloadRecord, "url"),
    entityId: readEntityId(payloadRecord),
    fetchedAt: input.fetchedAt,
    payload,
    repo: input.repo,
    sourceKind: input.sourceKind,
  });
}

function createResult<TSource>(
  response: GitHubRestResponse<unknown>,
  sources: readonly TSource[],
): {
  readonly cache: { readonly etag?: string; readonly lastModified?: string };
  readonly headers: GitHubRestResponse<unknown>["headers"];
  readonly notModified: boolean;
  readonly sources: readonly TSource[];
  readonly status: number;
} {
  return {
    cache: createCacheValidators(response),
    headers: response.headers,
    notModified: response.notModified,
    sources,
    status: response.status,
  };
}

function createCacheValidators(response: GitHubRestResponse<unknown>): {
  readonly etag?: string;
  readonly lastModified?: string;
} {
  return {
    ...createOptionalEtag(readHeader(response.headers, "etag")),
    ...createOptionalLastModified(readHeader(response.headers, "last-modified")),
  };
}

function createCacheValidatorRequestFields(
  cache: {
    readonly etag?: string;
    readonly lastModified?: string;
  } = {},
): { readonly etag?: string; readonly lastModified?: string } {
  return {
    ...createOptionalEtag(cache.etag),
    ...createOptionalLastModified(cache.lastModified),
  };
}

function createOptionalParameters(parameters: Record<string, unknown> | undefined): {
  readonly parameters?: Record<string, unknown>;
} {
  return parameters === undefined ? {} : { parameters };
}

function createOptionalAbortSignal(signal: AbortSignal | undefined): {
  readonly signal?: AbortSignal;
} {
  return signal === undefined ? {} : { signal };
}

function createOptionalPaginate(value: boolean | undefined): { readonly paginate?: boolean } {
  return value === undefined ? {} : { paginate: value };
}

function createOptionalPerPage(value: number | undefined): { readonly perPage?: number } {
  return value === undefined ? {} : { perPage: value };
}

function createOptionalEtag(value: string | undefined): { readonly etag?: string } {
  return value === undefined ? {} : { etag: value };
}

function createOptionalLastModified(value: string | undefined): { readonly lastModified?: string } {
  return value === undefined ? {} : { lastModified: value };
}

function splitRepoName(repoName: string): { readonly owner: string; readonly repo: string } {
  const [owner, repo] = repoName.split("/");

  if (owner === undefined || repo === undefined) {
    throw new Error(`Invalid repository name: ${repoName}`);
  }

  return { owner, repo };
}

function readHeader(
  headers: GitHubRestResponse<unknown>["headers"],
  key: string,
): string | undefined {
  const value = headers[key];

  return typeof value === "string" ? value : undefined;
}

function readEntityId(payload: object): GitHubEntityId | undefined {
  const id = readUnknown(payload, "id");

  return typeof id === "number" || typeof id === "string" ? id : undefined;
}

function readString(payload: object, key: string): string | undefined {
  const value = readUnknown(payload, key);

  return typeof value === "string" ? value : undefined;
}

function readUnknown(payload: object, key: string): unknown {
  return (payload as Record<string, unknown>)[key];
}
