import type { LocalNotification, LocalNotificationType } from "../domain/notification.js"
import type { LocalNotificationId } from "../domain/shared.js"

const COMMENT_LIKE_TYPES = new Set<LocalNotificationType>([
  "mention",
  "pr_comment",
  "pr_review_comment",
])
const LIFECYCLE_TYPES = new Set<LocalNotificationType>(["pr_closed", "pr_merged"])

export interface NotificationReplacementPolicyInput {
  readonly existingNotifications: readonly LocalNotification[]
  readonly incomingNotifications: readonly LocalNotification[]
}

export interface NotificationReplacementPolicyResult {
  readonly ejectedNotificationIds: readonly LocalNotificationId[]
  readonly notificationsToUpsert: readonly LocalNotification[]
}

/**
 * Applies local replacement/ejection rules after mapping but before repository writes.
 *
 * Mappers create candidate notifications from source records; this policy decides which older
 * stored records should disappear when GitHub source state makes them stale.
 */
export function applyNotificationReplacementPolicy(
  input: NotificationReplacementPolicyInput,
): NotificationReplacementPolicyResult {
  const ejectedNotificationIds = input.incomingNotifications.flatMap((incoming) =>
    findEjectedNotificationIds(input.existingNotifications, incoming),
  )

  return {
    ejectedNotificationIds: [...new Set(ejectedNotificationIds)],
    notificationsToUpsert: filterIncomingNotifications(input.incomingNotifications),
  }
}

function filterIncomingNotifications(
  incomingNotifications: readonly LocalNotification[],
): readonly LocalNotification[] {
  return incomingNotifications.filter(
    (incoming, index) => !isEjectedByIncoming(incomingNotifications, incoming, index),
  )
}

/** Removes incoming candidates made stale by newer activity in the same polling batch. */
function isEjectedByIncoming(
  incomingNotifications: readonly LocalNotification[],
  candidate: LocalNotification,
  candidateIndex: number,
): boolean {
  return incomingNotifications.some(
    (incoming, index) =>
      index !== candidateIndex &&
      (incomingLifecycleEjectsCandidate(incoming, candidate, index, candidateIndex) ||
        incomingFailedCheckReplacesCandidate(incoming, candidate, index, candidateIndex)),
  )
}

function findEjectedNotificationIds(
  existingNotifications: readonly LocalNotification[],
  incoming: LocalNotification,
): readonly LocalNotificationId[] {
  if (incoming.type === "failed_check") {
    return findReplacedFailedChecks(existingNotifications, incoming)
  }

  return LIFECYCLE_TYPES.has(incoming.type)
    ? findLifecycleEjections(existingNotifications, incoming)
    : []
}

/** Finds stored failed-check notifications superseded by a newer check in the same PR context. */
function findReplacedFailedChecks(
  existingNotifications: readonly LocalNotification[],
  incoming: LocalNotification,
): readonly LocalNotificationId[] {
  return existingNotifications
    .filter((existing) => isSameCheckContext(existing, incoming))
    .filter((existing) => incoming.sourceTimestamp >= existing.sourceTimestamp)
    .filter((existing) => existing.sourceFingerprint !== incoming.sourceFingerprint)
    .map((existing) => existing.id)
}

/** Finds stored non-comment thread notifications pruned by a newer close/merge lifecycle event. */
function findLifecycleEjections(
  existingNotifications: readonly LocalNotification[],
  incoming: LocalNotification,
): readonly LocalNotificationId[] {
  return existingNotifications
    .filter((existing) => existing.threadId === incoming.threadId)
    .filter((existing) => !COMMENT_LIKE_TYPES.has(existing.type))
    .filter((existing) => existing.id !== incoming.id)
    .filter((existing) => incoming.sourceTimestamp >= existing.sourceTimestamp)
    .map((existing) => existing.id)
}

/** Applies lifecycle pruning within a single incoming batch before repository writes. */
function incomingLifecycleEjectsCandidate(
  incoming: LocalNotification,
  candidate: LocalNotification,
  incomingIndex: number,
  candidateIndex: number,
): boolean {
  return (
    LIFECYCLE_TYPES.has(incoming.type) &&
    incoming.threadId === candidate.threadId &&
    !COMMENT_LIKE_TYPES.has(candidate.type) &&
    incoming.id !== candidate.id &&
    isNewerIncomingNotification(incoming, candidate, incomingIndex, candidateIndex)
  )
}

/** Applies failed-check replacement within a single incoming batch before repository writes. */
function incomingFailedCheckReplacesCandidate(
  incoming: LocalNotification,
  candidate: LocalNotification,
  incomingIndex: number,
  candidateIndex: number,
): boolean {
  return (
    isSameCheckContext(candidate, incoming) &&
    incoming.type === "failed_check" &&
    candidate.sourceFingerprint !== incoming.sourceFingerprint &&
    isNewerIncomingNotification(incoming, candidate, incomingIndex, candidateIndex)
  )
}

/** Orders same-batch candidates by source time, then stable array order for equal timestamps. */
function isNewerIncomingNotification(
  incoming: LocalNotification,
  candidate: LocalNotification,
  incomingIndex: number,
  candidateIndex: number,
): boolean {
  return (
    incoming.sourceTimestamp > candidate.sourceTimestamp ||
    (incoming.sourceTimestamp === candidate.sourceTimestamp && incomingIndex > candidateIndex)
  )
}

/** Identifies the check context whose latest result should be represented by one notification. */
function isSameCheckContext(existing: LocalNotification, incoming: LocalNotification): boolean {
  return (
    existing.threadId === incoming.threadId &&
    existing.type === "failed_check" &&
    existing.title === incoming.title
  )
}
