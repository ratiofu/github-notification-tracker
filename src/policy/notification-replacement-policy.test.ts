import type { LocalNotification, LocalNotificationType } from "../domain/notification.js"
import { describe, expect, it } from "vitest"
import { applyNotificationReplacementPolicy } from "./notification-replacement-policy.js"
import { createNotificationFixture } from "../domain/fixtures.js"

const CLOSED_ID = "closed0000000000"
const COMMENT_ID = "comment000000000"
const FAILED_CHECK_ID = "failed0000000000"
const INCOMING_CHECK_ID = "incomingChk00000"
const MENTION_ID = "mention000000000"
const MERGED_ID = "merged0000000000"
const NEWER_SOURCE_TIMESTAMP = "2026-05-01T00:10:00.000Z"
const OLDER_SOURCE_TIMESTAMP = "2026-05-01T00:00:00.000Z"
const OTHER_CHECK_ID = "other00000000000"
const REVIEW_ID = "review0000000000"
const REVIEW_COMMENT_ID = "reviewComment000"

describe("notification replacement policy", () => {
  it("ejects older failed checks for the same check context", ejectsReplacedFailedChecks)
  it("keeps failed checks for different check contexts", keepsDifferentFailedChecks)
  it("ejects non-comment notifications when a PR is merged", ejectsMergedPullRequestNotifications)
  it("ejects non-comment notifications when a PR is closed", ejectsClosedPullRequestNotifications)
  it(
    "filters same-batch lifecycle ejections from incoming upserts",
    filtersIncomingLifecycleEjections,
  )
  it(
    "filters same-batch failed-check replacements from incoming upserts",
    filtersIncomingCheckReplacements,
  )
  it("keeps newer stored notifications when incoming checks are stale", keepsNewerStoredChecks)
  it(
    "keeps newer stored notifications when incoming lifecycle events are stale",
    keepsNewerStoredRows,
  )
  it(
    "keeps same-batch failed checks when incoming non-checks share a title",
    keepsChecksForNonChecks,
  )
})

function ejectsReplacedFailedChecks(): void {
  const oldFailure = createNotification({ id: FAILED_CHECK_ID, sourceFingerprint: "check:old" })
  const newFailure = createNotification({ sourceFingerprint: "check:new" })

  expect(
    applyNotificationReplacementPolicy(createPolicyInput([oldFailure], [newFailure])),
  ).toStrictEqual({
    ejectedNotificationIds: [FAILED_CHECK_ID],
    notificationsToUpsert: [newFailure],
  })
}

function keepsDifferentFailedChecks(): void {
  const oldFailure = createNotification({ id: FAILED_CHECK_ID, sourceFingerprint: "check:old" })
  const otherFailure = createNotification({
    id: OTHER_CHECK_ID,
    sourceFingerprint: "check:other",
    title: "lint",
  })

  expect(
    applyNotificationReplacementPolicy(createPolicyInput([oldFailure], [otherFailure])),
  ).toStrictEqual({
    ejectedNotificationIds: [],
    notificationsToUpsert: [otherFailure],
  })
}

function ejectsMergedPullRequestNotifications(): void {
  const rows = createLifecycleRows("pr_merged", MERGED_ID)

  expect(
    applyNotificationReplacementPolicy(createPolicyInput(rows.existing, [rows.lifecycle])),
  ).toStrictEqual({
    ejectedNotificationIds: [FAILED_CHECK_ID, REVIEW_ID],
    notificationsToUpsert: [rows.lifecycle],
  })
}

function ejectsClosedPullRequestNotifications(): void {
  const rows = createLifecycleRows("pr_closed", CLOSED_ID)

  expect(
    applyNotificationReplacementPolicy(createPolicyInput(rows.existing, [rows.lifecycle])),
  ).toStrictEqual({
    ejectedNotificationIds: [FAILED_CHECK_ID, REVIEW_ID],
    notificationsToUpsert: [rows.lifecycle],
  })
}

function filtersIncomingLifecycleEjections(): void {
  const rows = createLifecycleRows("pr_merged", MERGED_ID)
  const incomingFailure = createNotification({ id: INCOMING_CHECK_ID })
  const incomingComment = createNotification({ id: COMMENT_ID, type: "pr_comment" })

  expect(
    applyNotificationReplacementPolicy(
      createPolicyInput([], [incomingFailure, rows.lifecycle, incomingComment]),
    ),
  ).toStrictEqual({
    ejectedNotificationIds: [],
    notificationsToUpsert: [rows.lifecycle, incomingComment],
  })
}

function filtersIncomingCheckReplacements(): void {
  const oldFailure = createNotification({
    id: FAILED_CHECK_ID,
    sourceFingerprint: "check:old",
    sourceTimestamp: OLDER_SOURCE_TIMESTAMP,
  })
  const newFailure = createNotification({
    id: INCOMING_CHECK_ID,
    sourceFingerprint: "check:new",
    sourceTimestamp: NEWER_SOURCE_TIMESTAMP,
  })

  expect(
    applyNotificationReplacementPolicy(createPolicyInput([], [oldFailure, newFailure])),
  ).toStrictEqual({
    ejectedNotificationIds: [],
    notificationsToUpsert: [newFailure],
  })
}

function keepsNewerStoredChecks(): void {
  const newerStoredFailure = createNotification({
    id: FAILED_CHECK_ID,
    sourceFingerprint: "check:newer",
    sourceTimestamp: NEWER_SOURCE_TIMESTAMP,
  })
  const olderIncomingFailure = createNotification({
    sourceFingerprint: "check:older",
    sourceTimestamp: OLDER_SOURCE_TIMESTAMP,
  })

  expect(
    applyNotificationReplacementPolicy(
      createPolicyInput([newerStoredFailure], [olderIncomingFailure]),
    ),
  ).toStrictEqual({
    ejectedNotificationIds: [],
    notificationsToUpsert: [olderIncomingFailure],
  })
}

function keepsNewerStoredRows(): void {
  const newerStoredFailure = createNotification({
    id: FAILED_CHECK_ID,
    sourceTimestamp: NEWER_SOURCE_TIMESTAMP,
  })
  const olderLifecycle = createNotification({
    id: MERGED_ID,
    sourceTimestamp: OLDER_SOURCE_TIMESTAMP,
    type: "pr_merged",
  })

  expect(
    applyNotificationReplacementPolicy(createPolicyInput([newerStoredFailure], [olderLifecycle])),
  ).toStrictEqual({
    ejectedNotificationIds: [],
    notificationsToUpsert: [olderLifecycle],
  })
}

function keepsChecksForNonChecks(): void {
  const failure = createNotification({
    id: FAILED_CHECK_ID,
    sourceTimestamp: OLDER_SOURCE_TIMESTAMP,
  })
  const reviewRequest = createNotification({
    id: REVIEW_ID,
    sourceFingerprint: "review-request:newer",
    sourceTimestamp: NEWER_SOURCE_TIMESTAMP,
    title: failure.title,
    type: "review_request",
  })

  expect(
    applyNotificationReplacementPolicy(createPolicyInput([], [failure, reviewRequest])),
  ).toStrictEqual({
    ejectedNotificationIds: [],
    notificationsToUpsert: [failure, reviewRequest],
  })
}

function createLifecycleRows(type: "pr_closed" | "pr_merged", id: string) {
  const lifecycle = createNotification({ id, type })

  return {
    existing: [
      createNotification({ id: FAILED_CHECK_ID }),
      createNotification({ id: REVIEW_ID, type: "review_request" }),
      createNotification({ id: COMMENT_ID, type: "pr_comment" }),
      createNotification({ id: REVIEW_COMMENT_ID, type: "pr_review_comment" }),
      createNotification({ id: MENTION_ID, type: "mention" }),
      lifecycle,
    ],
    lifecycle,
  }
}

function createNotification(
  options: {
    readonly id?: string
    readonly sourceFingerprint?: string
    readonly sourceTimestamp?: string
    readonly title?: string
    readonly type?: LocalNotificationType
  } = {},
): LocalNotification {
  return createNotificationFixture({
    ...optionalId(options.id),
    sourceFingerprint: options.sourceFingerprint ?? "check:failing",
    ...optionalSourceTimestamp(options.sourceTimestamp),
    ...optionalTitle(options.title),
    type: options.type ?? "failed_check",
  })
}

function optionalId(id: string | undefined): { readonly id?: string } {
  return id === undefined ? {} : { id }
}

function optionalTitle(title: string | undefined): { readonly title?: string } {
  return title === undefined ? {} : { title }
}

function optionalSourceTimestamp(sourceTimestamp: string | undefined): {
  readonly sourceTimestamp?: string
} {
  return sourceTimestamp === undefined ? {} : { sourceTimestamp }
}

function createPolicyInput(
  existingNotifications: readonly LocalNotification[],
  incomingNotifications: readonly LocalNotification[],
) {
  return { existingNotifications, incomingNotifications }
}
