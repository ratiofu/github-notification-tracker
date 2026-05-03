import type { GitHubFetchedAt, GitHubSourceKind } from "./source-types.js"
import {
  GitHubPullRequestSourceSchema,
  GitHubSourcePayloadWrapperSchema,
} from "../domain/github-source.js"
import type { GitHubRestResponse } from "./types.js"
import { z } from "zod"

type SourceWrapper = ReturnType<typeof GitHubSourcePayloadWrapperSchema.parse>

export interface PullRequestApiPayload {
  readonly head: { readonly sha: string }
  readonly id: number
  readonly number: number
  readonly state: "closed" | "open"
  readonly updated_at: string
  readonly url: string
}

export function createPullRequestSource(
  payload: PullRequestApiPayload,
  repo: string,
  fetchedAt: GitHubFetchedAt,
): ReturnType<typeof GitHubPullRequestSourceSchema.parse> {
  return GitHubPullRequestSourceSchema.parse({
    apiUrl: payload.url,
    entityId: payload.id,
    fetchedAt,
    headSha: payload.head.sha,
    payload,
    pullRequestNumber: payload.number,
    repo,
    sourceKind: "pull_request",
    state: payload.state,
    updatedAt: payload.updated_at,
  })
}

export function createSourceWrappers(
  payloads: readonly unknown[],
  repo: string,
  sourceKind: GitHubSourceKind,
  fetchedAt: GitHubFetchedAt,
): readonly SourceWrapper[] {
  return payloads.map((payload) =>
    createSourceWrapper({
      fetchedAt,
      payload,
      repo,
      sourceKind,
    }),
  )
}

export function createSourceWrapper(input: {
  readonly fetchedAt: GitHubFetchedAt
  readonly payload: unknown
  readonly repo: string
  readonly sourceKind: GitHubSourceKind
}): SourceWrapper {
  const payload = z.json().parse(input.payload)
  const payloadRecord = typeof payload === "object" && payload !== null ? payload : {}

  return GitHubSourcePayloadWrapperSchema.parse({
    apiUrl: readString(payloadRecord, "url"),
    entityId: readEntityId(payloadRecord),
    fetchedAt: input.fetchedAt,
    payload,
    repo: input.repo,
    sourceKind: input.sourceKind,
  })
}

export function createResult<TSource>(
  response: GitHubRestResponse<unknown>,
  sources: readonly TSource[],
): {
  readonly cache: { readonly etag?: string; readonly lastModified?: string }
  readonly headers: GitHubRestResponse<unknown>["headers"]
  readonly notModified: boolean
  readonly sources: readonly TSource[]
  readonly status: number
} {
  return {
    cache: createCacheValidators(response),
    headers: response.headers,
    notModified: response.notModified,
    sources,
    status: response.status,
  }
}

export function createCacheValidatorRequestFields(
  cache: {
    readonly etag?: string
    readonly lastModified?: string
  } = {},
): { readonly etag?: string; readonly lastModified?: string } {
  return {
    ...createOptionalEtag(cache.etag),
    ...createOptionalLastModified(cache.lastModified),
  }
}

export function createOptionalParameters(parameters: Record<string, unknown> | undefined): {
  readonly parameters?: Record<string, unknown>
} {
  return parameters === undefined ? {} : { parameters }
}

export function createOptionalAbortSignal(signal: AbortSignal | undefined): {
  readonly signal?: AbortSignal
} {
  return signal === undefined ? {} : { signal }
}

export function createOptionalPaginate(value: boolean | undefined): {
  readonly paginate?: boolean
} {
  return value === undefined ? {} : { paginate: value }
}

export function createOptionalPerPage(value: number | undefined): { readonly perPage?: number } {
  return value === undefined ? {} : { perPage: value }
}

export function splitRepoName(repoName: string): { readonly owner: string; readonly repo: string } {
  const [owner, repo] = repoName.split("/")

  if (owner === undefined || repo === undefined) {
    throw new Error(`Invalid repository name: ${repoName}`)
  }

  return { owner, repo }
}

function createCacheValidators(response: GitHubRestResponse<unknown>): {
  readonly etag?: string
  readonly lastModified?: string
} {
  return {
    ...createOptionalEtag(readHeader(response.headers, "etag")),
    ...createOptionalLastModified(readHeader(response.headers, "last-modified")),
  }
}

function createOptionalEtag(value: string | undefined): { readonly etag?: string } {
  return value === undefined ? {} : { etag: value }
}

function createOptionalLastModified(value: string | undefined): { readonly lastModified?: string } {
  return value === undefined ? {} : { lastModified: value }
}

function readHeader(
  headers: GitHubRestResponse<unknown>["headers"],
  key: string,
): string | undefined {
  const value = headers[key]

  return typeof value === "string" ? value : undefined
}

function readEntityId(payload: object): number | string | undefined {
  const id = readUnknown(payload, "id")

  return typeof id === "number" || typeof id === "string" ? id : undefined
}

function readString(payload: object, key: string): string | undefined {
  const value = readUnknown(payload, key)

  return typeof value === "string" ? value : undefined
}

function readUnknown(payload: object, key: string): unknown {
  return (payload as Record<string, unknown>)[key]
}
