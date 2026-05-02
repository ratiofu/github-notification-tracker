import type {
  GitHubPullRequestSource,
  GitHubSourceKind,
  GitHubSourcePayloadWrapper,
  IsoDateTime,
  RepoName,
} from "../domain/index.js";
import type { GitHubRestRequester, GitHubTransportHeaders } from "./types.js";

export interface GitHubSourceFetcherOptions {
  readonly client: GitHubRestRequester;
  readonly now?: () => Date;
}

export interface GitHubCacheValidators {
  readonly etag?: string;
  readonly lastModified?: string;
}

export interface GitHubRepoFetchInput {
  readonly cache?: GitHubCacheValidators;
  readonly perPage?: number;
  readonly repo: RepoName;
  readonly signal?: AbortSignal;
}

export interface GitHubPullRequestFetchInput extends GitHubRepoFetchInput {
  readonly pullRequestNumber: number;
}

export interface GitHubCheckRunFetchInput extends GitHubRepoFetchInput {
  readonly headSha: string;
}

export interface GitHubTeamMemberFetchInput extends GitHubRepoFetchInput {
  readonly org: string;
  readonly teamSlug: string;
}

export interface GitHubSourceFetchResult<TSource> {
  readonly cache: GitHubCacheValidators;
  readonly headers: GitHubTransportHeaders;
  readonly notModified: boolean;
  readonly sources: readonly TSource[];
  readonly status: number;
}

export type GitHubGenericSourceFetchResult = GitHubSourceFetchResult<GitHubSourcePayloadWrapper>;
export type GitHubPullRequestSourceFetchResult = GitHubSourceFetchResult<GitHubPullRequestSource>;

export interface GitHubRawSourceRequest {
  readonly input: GitHubRepoFetchInput;
  readonly paginate?: boolean;
  readonly route: string;
  readonly sourceKind: GitHubSourceKind;
}

export type GitHubFetchedAt = IsoDateTime;
