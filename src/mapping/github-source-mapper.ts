import type { DebugWarning, DebugWarningSeverity } from "../domain/debug.js"
import type { GitHubActor, LocalNotificationId } from "../domain/shared.js"
import type {
  GitHubPullRequestSource,
  GitHubSourcePayloadWrapper,
} from "../domain/github-source.js"
import type { LocalNotification, LocalNotificationType } from "../domain/notification.js"
import {
  PullRequestMapperPayloadSchema,
  SourceActivityPayloadSchema,
  normalizeActor,
} from "./github-source-payloads.js"
import type { PullRequestMetadata, PullRequestThread } from "../domain/notification-thread.js"
import {
  collectParticipants,
  collectTargets,
  createNotificationText,
  createNotificationTitle,
  getPayloadId,
  getSourceTimestamp,
  hasMentionTargets,
  isAuthenticatedActor,
  toMappedRawPayload,
  toSourceJsonReference,
} from "./github-source-mapper-helpers.js"
import { createLocalNotificationId } from "./local-notification-id.js"
import { createSourceFingerprint } from "./source-fingerprint.js"

const CLOSED_EVENT = "closed"
const FAILURE_CONCLUSIONS = new Set(["action_required", "failure", "timed_out"])
const MERGED_EVENT = "merged"
const REVIEW_REQUESTED_EVENT = "review_requested"
const REPO_OWNER_INDEX = 0
const WARNING_SEVERITY: DebugWarningSeverity = "warn"

type SourceActivityPayload = ReturnType<typeof SourceActivityPayloadSchema.parse>

export interface GitHubSourceMappingInput {
  readonly authenticatedUserLogin: string
  readonly createNotificationId?: () => LocalNotificationId
  readonly now?: () => Date
  readonly pullRequestSource: GitHubPullRequestSource
  readonly sources: readonly GitHubSourcePayloadWrapper[]
}

export interface GitHubSourceMappingResult {
  readonly notifications: readonly LocalNotification[]
  readonly rawPayloads: readonly ReturnType<typeof toMappedRawPayload>[]
  readonly thread: PullRequestThread
  readonly warnings: readonly DebugWarning[]
}

interface SourceContext {
  readonly authenticatedUserLogin: string
  readonly createdAt: string
  readonly idFactory: () => LocalNotificationId
  readonly parentPr: PullRequestMetadata
  readonly repoOwner: string
  readonly threadId: string
}

interface NotificationDraft {
  readonly actor: GitHubActor
  readonly context: SourceContext
  readonly payload: SourceActivityPayload
  readonly source: GitHubSourcePayloadWrapper
  readonly type: LocalNotificationType
}

/**
 * Converts fetched GitHub wrappers into the local persistence model.
 *
 * Fetchers own API calls and repositories own writes; this pure layer owns the policy that
 * decides which source records become notifications, raw payload references, and warnings.
 */
export function mapGitHubSources(input: GitHubSourceMappingInput): GitHubSourceMappingResult {
  const parentPr = toPullRequestMetadata(input.pullRequestSource)
  const context = createSourceContext(input, parentPr)
  const rawPayloads = [input.pullRequestSource, ...input.sources].map((source) =>
    toMappedRawPayload(source),
  )
  const mapped = input.sources.map((source) => mapSource(source, context))
  const notifications = mapped.flatMap((item) => item.notifications)

  return {
    notifications,
    rawPayloads,
    thread: createThread(input.pullRequestSource, parentPr, notifications),
    warnings: mapped.flatMap((item) => item.warnings),
  }
}

function createSourceContext(
  input: GitHubSourceMappingInput,
  parentPr: PullRequestMetadata,
): SourceContext {
  return {
    authenticatedUserLogin: input.authenticatedUserLogin,
    createdAt: (input.now ?? (() => new Date()))().toISOString(),
    idFactory: input.createNotificationId ?? createLocalNotificationId,
    parentPr,
    repoOwner: getRepoOwner(parentPr.repo),
    threadId: createPullRequestThreadId(parentPr),
  }
}

function mapSource(source: GitHubSourcePayloadWrapper, context: SourceContext) {
  const parsed = SourceActivityPayloadSchema.safeParse(source.payload)
  if (!parsed.success) {
    return createWarningResult(source, "Unsupported GitHub source payload")
  }

  const actor = pickActor(parsed.data)
  if (isAuthenticatedActor(actor, context.authenticatedUserLogin)) {
    return createWarningResult(source, "Ignored authenticated-user activity")
  }

  return createNotificationForSource(source, parsed.data, actor, context)
}

function createNotificationForSource(
  source: GitHubSourcePayloadWrapper,
  payload: SourceActivityPayload,
  actor: GitHubActor,
  context: SourceContext,
) {
  const type = chooseNotificationType(source, payload, context.authenticatedUserLogin)
  if (type === undefined) {
    return createWarningResult(source, "Unsupported GitHub source activity")
  }

  return {
    notifications: [toNotification({ actor, context, payload, source, type })],
    warnings: [],
  }
}

function chooseNotificationType(
  source: GitHubSourcePayloadWrapper,
  payload: SourceActivityPayload,
  authenticatedUserLogin: string,
): LocalNotificationType | undefined {
  // Mentions are surfaced as direct notifications even when the underlying GitHub event is
  // Otherwise a normal comment or review comment.
  if (hasMentionTargets(payload, authenticatedUserLogin)) {
    return "mention"
  }

  return chooseNonMentionType(source.sourceKind, payload)
}

function chooseNonMentionType(sourceKind: string, payload: SourceActivityPayload) {
  if (sourceKind === "issue_comment") {
    return "pr_comment"
  }
  if (sourceKind === "review_comment") {
    return "pr_review_comment"
  }
  if (sourceKind === "review") {
    return "pr_review_submission"
  }
  if (sourceKind === "check_run" && isFailedCheck(payload)) {
    return "failed_check"
  }
  return chooseTimelineType(payload.event)
}

function chooseTimelineType(event: string | undefined): LocalNotificationType | undefined {
  if (event === REVIEW_REQUESTED_EVENT) {
    return "review_request"
  }
  if (event === MERGED_EVENT) {
    return "pr_merged"
  }
  if (event === CLOSED_EVENT) {
    return "pr_closed"
  }
  return undefined
}

function toNotification(draft: NotificationDraft): LocalNotification {
  return {
    actor: draft.actor,
    createdAt: draft.context.createdAt,
    explicitTargets: collectTargets(
      draft.payload,
      draft.context.authenticatedUserLogin,
      draft.context.repoOwner,
    ),
    githubEntityId: draft.payload.id,
    id: draft.context.idFactory(),
    isRead: false,
    parentPr: draft.context.parentPr,
    parentPrState: draft.context.parentPr.state,
    participants: collectParticipants(draft.actor, draft.context.parentPr.author),
    readAt: null,
    sourceFingerprint: createSourceFingerprint({
      entityId: draft.payload.id,
      sourceKind: draft.source.sourceKind,
      type: draft.type,
    }),
    sourceJsonReferences: [toSourceJsonReference(draft.source)],
    sourceTimestamp: getSourceTimestamp(draft.payload, draft.source.fetchedAt),
    targetUrl: draft.payload.html_url ?? draft.context.parentPr.url,
    text: createNotificationText(draft.payload, draft.type),
    threadId: draft.context.threadId,
    title: createNotificationTitle(draft.payload, draft.type, draft.context.parentPr),
    type: draft.type,
  }
}

function toPullRequestMetadata(source: GitHubPullRequestSource): PullRequestMetadata {
  const payload = PullRequestMapperPayloadSchema.parse(source.payload)

  return {
    author: normalizeActor(payload.user),
    baseRef: payload.base?.ref,
    entityId: payload.id ?? source.entityId,
    headRef: payload.head?.ref,
    headSha: source.headSha,
    number: payload.number,
    repo: source.repo,
    state: payload.merged_at === undefined || payload.merged_at === null ? payload.state : "merged",
    title: payload.title,
    url: payload.html_url,
  }
}

function createThread(
  source: GitHubPullRequestSource,
  parentPr: PullRequestMetadata,
  notifications: readonly LocalNotification[],
): PullRequestThread {
  // Threads are emitted with child IDs so storage can persist the PR grouping separately from
  // Individual notifications while renderers still get a ready grouping model.
  return {
    notificationIds: notifications.map((notification) => notification.id),
    pullRequest: parentPr,
    thread: {
      id: createPullRequestThreadId(parentPr),
      kind: "pull_request",
      repo: source.repo,
      sourceUpdatedAt: source.updatedAt,
      targetUrl: parentPr.url,
      title: parentPr.title,
    },
  }
}

function createPullRequestThreadId(parentPr: PullRequestMetadata) {
  return `pr:${String(parentPr.entityId ?? `${parentPr.repo}:${String(parentPr.number)}`)}`
}

function getRepoOwner(repo: string) {
  return repo.split("/").at(REPO_OWNER_INDEX) ?? repo
}

function isFailedCheck(payload: SourceActivityPayload) {
  return payload.conclusion !== null && FAILURE_CONCLUSIONS.has(payload.conclusion ?? "")
}

function pickActor(payload: SourceActivityPayload): GitHubActor {
  return normalizeActor(payload.user ?? payload.actor ?? payload.requested_reviewer)
}

function createWarningResult(source: GitHubSourcePayloadWrapper, message: string) {
  // Unsupported or intentionally skipped sources still point at raw payloads so debug mode can
  // Explain why visible notifications were not created.
  return {
    notifications: [],
    warnings: [
      {
        id: `${source.sourceKind}:${String(source.entityId ?? getPayloadId(source.payload))}:${message}`,
        message,
        severity: WARNING_SEVERITY,
        sourceReference: toSourceJsonReference(source),
      },
    ],
  }
}
