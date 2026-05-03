import type {
  ExplicitTarget,
  Participant,
  ParticipantSelection,
  UserParticipant,
} from "../domain/participant.js"
import type { GitHubActor, RawGitHubPayload, SourceJsonReference } from "../domain/shared.js"
import type { GitHubSourcePayloadWrapper } from "../domain/github-source.js"
import type { LocalNotificationType } from "../domain/notification.js"
import { MINIMUM_TEXT_LENGTH } from "../constants.js"
import type { PullRequestMetadata } from "../domain/notification-thread.js"
import type { SourceActivityPayload } from "./github-source-payloads.js"
import { z } from "zod"

const FIRST_CAPTURE_GROUP_INDEX = 1
const SECOND_CAPTURE_GROUP_INDEX = 2
const TEAM_MENTION_PATTERN = /@([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/gu

export interface MappedRawGitHubPayload {
  readonly payload: RawGitHubPayload
  readonly storageKey: string
}

/** Builds the raw-payload row plus the key notifications store for later debug lookups. */
export function toMappedRawPayload(source: GitHubSourcePayloadWrapper): MappedRawGitHubPayload {
  const htmlUrl = getPayloadUrl(source.payload, "html_url")

  return {
    payload: {
      ...(source.apiUrl === undefined ? {} : { apiUrl: source.apiUrl }),
      fetchedAt: source.fetchedAt,
      ...(htmlUrl === undefined ? {} : { htmlUrl }),
      id: String(source.entityId ?? getPayloadId(source.payload)),
      payload: source.payload,
    },
    storageKey: createRawPayloadStorageKey(source),
  }
}

export function toSourceJsonReference(source: GitHubSourcePayloadWrapper): SourceJsonReference {
  return {
    sourceId: String(source.entityId ?? getPayloadId(source.payload)),
    sourceKind: source.sourceKind,
    storageKey: createRawPayloadStorageKey(source),
  }
}

/** Mirrors raw payload storage keys so notification records can reference source JSON exactly. */
export function createRawPayloadStorageKey(source: GitHubSourcePayloadWrapper): string {
  return `${source.sourceKind}:${String(source.entityId ?? getPayloadId(source.payload))}`
}

export function collectParticipants(
  actor: GitHubActor,
  author: GitHubActor,
): readonly Participant[] {
  return [toUserParticipant(actor), toUserParticipant(author)]
}

export function collectTargets(
  payload: SourceActivityPayload,
  authenticatedUserLogin: string,
  repoOwner: string,
): readonly ExplicitTarget[] {
  // Explicit targets are only direct asks: authenticated-user mentions, team mentions, or
  // Review-request recipients. Broader participant matching is handled by later filter code.
  const userTargets = hasUserMention(payload.body, authenticatedUserLogin)
    ? [{ kind: "user" as const, login: authenticatedUserLogin }]
    : []

  return [
    ...userTargets,
    ...collectTeamMentions(payload.body),
    ...collectReviewTargets(payload, repoOwner),
  ]
}

export function hasMentionTargets(
  payload: SourceActivityPayload,
  authenticatedUserLogin: string,
): boolean {
  return (
    hasUserMention(payload.body, authenticatedUserLogin) ||
    collectTeamMentions(payload.body).length > MINIMUM_TEXT_LENGTH - MINIMUM_TEXT_LENGTH
  )
}

export function isAuthenticatedActor(actor: GitHubActor, authenticatedUserLogin: string): boolean {
  return actor.login.toLowerCase() === authenticatedUserLogin.toLowerCase()
}

export function getSourceTimestamp(payload: SourceActivityPayload, fetchedAt: string): string {
  return (
    payload.updated_at ??
    payload.submitted_at ??
    payload.completed_at ??
    payload.created_at ??
    fetchedAt
  )
}

export function createNotificationTitle(
  payload: SourceActivityPayload,
  type: LocalNotificationType,
  parentPr: PullRequestMetadata,
): string {
  return payload.title ?? payload.name ?? `${toTitleLabel(type)} on #${String(parentPr.number)}`
}

export function createNotificationText(
  payload: SourceActivityPayload,
  type: LocalNotificationType,
): string {
  return payload.body ?? payload.state ?? payload.conclusion ?? toTitleLabel(type)
}

export function getPayloadId(payload: unknown): string | number {
  const parsed = z.looseObject({ id: z.union([z.string(), z.number()]) }).safeParse(payload)

  return parsed.success ? parsed.data.id : "unknown"
}

function toUserParticipant(actor: GitHubActor): UserParticipant {
  return {
    ...(actor.avatarUrl === undefined ? {} : { avatarUrl: actor.avatarUrl }),
    ...(actor.id === undefined ? {} : { id: actor.id }),
    kind: "user",
    login: actor.login,
    ...(actor.url === undefined ? {} : { url: actor.url }),
  }
}

function collectReviewTargets(
  payload: SourceActivityPayload,
  repoOwner: string,
): readonly ParticipantSelection[] {
  if (payload.requested_reviewer !== undefined) {
    return [{ kind: "user", login: payload.requested_reviewer.login }]
  }
  if (payload.requested_team !== undefined) {
    return [{ kind: "team", org: repoOwner, slug: payload.requested_team.slug }]
  }
  return []
}

function collectTeamMentions(body: string | null | undefined): readonly ParticipantSelection[] {
  return [...(body ?? "").matchAll(TEAM_MENTION_PATTERN)].map((match) => ({
    kind: "team",
    org: match[FIRST_CAPTURE_GROUP_INDEX] ?? "github",
    slug: match[SECOND_CAPTURE_GROUP_INDEX] ?? "team",
  }))
}

function hasUserMention(body: string | null | undefined, login: string) {
  return new RegExp(`(^|[^A-Za-z0-9_.-])@${escapeRegExp(login)}(?![A-Za-z0-9_.-])`, "iu").test(
    body ?? "",
  )
}

function toTitleLabel(type: LocalNotificationType) {
  return type.replaceAll("_", " ")
}

function getPayloadUrl(payload: unknown, field: string) {
  const parsed = z.record(z.string(), z.unknown()).safeParse(payload)
  const value = parsed.success ? parsed.data[field] : undefined

  return typeof value === "string" ? value : undefined
}

function escapeRegExp(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
}
