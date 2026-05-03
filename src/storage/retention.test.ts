import { afterEach, describe, expect, it } from "vitest"

import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js"
import {
  createNotificationFixture,
  createRawPayloadFixture,
  createThreadFixture,
} from "../domain/fixtures.js"
import { LocalNotificationRepository } from "./local-notification-repository.js"
import { PullRequestThreadRepository } from "./pull-request-thread-repository.js"
import { RawGitHubPayloadRepository } from "./raw-github-payload-repository.js"
import { ReadStateRepository } from "./read-state-repository.js"
import { pruneStorageByRetention } from "./retention.js"

const NONE_DELETED = 0
const ONE_DELETED = 1
const NOW = "2026-05-01T00:00:00.000Z"
const OLD_TIMESTAMP = "2026-04-01T00:00:00.000Z"
const OLD_READ_AT = "2026-04-01T00:10:00.000Z"
const OLD_NOTIFICATION_ID = "oldNotification000001"
const OLD_PR_NUMBER = 41
const OLD_THREAD_ID = "pr:acme/widgets:41"
const PRUNE_FAILURE = /no such table: raw_github_payloads/u
const EXPECTED_PRUNE_RESULT = {
  deletedNotifications: ONE_DELETED,
  deletedRawPayloads: ONE_DELETED,
  deletedReadStates: NONE_DELETED,
  deletedThreads: ONE_DELETED,
} as const

interface TestRepositories {
  readonly notificationRepository: LocalNotificationRepository
  readonly rawRepository: RawGitHubPayloadRepository
  readonly readStateRepository: ReadStateRepository
  readonly threadRepository: PullRequestThreadRepository
}

interface RetentionRows {
  readonly newNotification: ReturnType<typeof createNotificationFixture>
  readonly newThread: ReturnType<typeof createThreadFixture>
  readonly oldNotification: ReturnType<typeof createOldNotification>
  readonly oldThread: ReturnType<typeof createOldThread>
}

describe("storage retention pruning", () => {
  afterEach(() => {
    cleanupTempStorage()
  })

  it("rolls back retention pruning when a delete fails", rollsBackWhenDeleteFails)
  it("prunes old notifications, raw payloads, read states, and empty threads", prunesExpiredRows)
})

async function rollsBackWhenDeleteFails(): Promise<void> {
  const storage = createTempStorage()
  const repositories = createRepositories(storage.db)
  const oldThread = createOldThread()
  const oldNotification = createOldNotification(oldThread)

  await seedOldNotification(repositories, oldThread, oldNotification)
  storage.db.exec("DROP TABLE raw_github_payloads")

  await expect(pruneStorageByRetention(storage.db, NOW)).rejects.toThrow(PRUNE_FAILURE)
  await assertOldRowsRemain(repositories, oldThread, oldNotification)
  await storage.close()
}

async function prunesExpiredRows(): Promise<void> {
  const storage = createTempStorage()
  const repositories = createRepositories(storage.db)
  const rows = createRetentionRows()

  await seedRetentionRows(repositories, rows)

  const result = await pruneStorageByRetention(storage.db, NOW)

  expect(result).toStrictEqual(EXPECTED_PRUNE_RESULT)
  await assertExpiredRowsWereDeleted(repositories, rows.oldThread, rows.oldNotification)
  await expect(
    repositories.notificationRepository.getById(rows.newNotification.id),
  ).resolves.toStrictEqual(rows.newNotification)
  await expect(repositories.rawRepository.getByStorageKey("new")).resolves.toStrictEqual(
    createRawPayloadFixture(),
  )
  await storage.close()
}

function createRepositories(db: ReturnType<typeof createTempStorage>["db"]): TestRepositories {
  return {
    notificationRepository: new LocalNotificationRepository(db),
    rawRepository: new RawGitHubPayloadRepository(db),
    readStateRepository: new ReadStateRepository(db),
    threadRepository: new PullRequestThreadRepository(db),
  }
}

function createOldThread() {
  return createThreadFixture({
    id: OLD_THREAD_ID,
    notificationIds: [OLD_NOTIFICATION_ID],
    number: OLD_PR_NUMBER,
    sourceUpdatedAt: OLD_TIMESTAMP,
  })
}

function createOldNotification(oldThread: ReturnType<typeof createOldThread>) {
  return createNotificationFixture({
    createdAt: OLD_TIMESTAMP,
    id: OLD_NOTIFICATION_ID,
    sourceFingerprint: "comment:old",
    sourceTimestamp: OLD_TIMESTAMP,
    thread: oldThread,
  })
}

function createRetentionRows(): RetentionRows {
  const oldThread = createOldThread()
  const newThread = createThreadFixture()

  return {
    newNotification: createNotificationFixture({ thread: newThread }),
    newThread,
    oldNotification: createOldNotification(oldThread),
    oldThread,
  }
}

async function seedOldNotification(
  repositories: TestRepositories,
  oldThread: ReturnType<typeof createOldThread>,
  oldNotification: ReturnType<typeof createOldNotification>,
): Promise<void> {
  await repositories.threadRepository.upsert(oldThread)
  await repositories.notificationRepository.upsert(oldNotification)
  await repositories.readStateRepository.set({
    isRead: true,
    notificationId: oldNotification.id,
    readAt: OLD_READ_AT,
  })
}

async function seedRetentionRows(
  repositories: TestRepositories,
  rows: RetentionRows,
): Promise<void> {
  await seedOldNotification(repositories, rows.oldThread, rows.oldNotification)
  await repositories.threadRepository.upsert(rows.newThread)
  await repositories.notificationRepository.upsert(rows.newNotification)
  await repositories.rawRepository.upsert("old", {
    ...createRawPayloadFixture(),
    fetchedAt: OLD_TIMESTAMP,
    id: "old",
  })
  await repositories.rawRepository.upsert("new", createRawPayloadFixture())
}

async function assertOldRowsRemain(
  repositories: TestRepositories,
  oldThread: ReturnType<typeof createOldThread>,
  oldNotification: ReturnType<typeof createOldNotification>,
): Promise<void> {
  await expect(
    repositories.notificationRepository.getById(oldNotification.id),
  ).resolves.toStrictEqual(oldNotification)
  await expect(repositories.threadRepository.getById(oldThread.thread.id)).resolves.toStrictEqual(
    oldThread,
  )
  await expect(repositories.readStateRepository.get(oldNotification.id)).resolves.toStrictEqual({
    isRead: true,
    notificationId: oldNotification.id,
    readAt: OLD_READ_AT,
  })
}

async function assertExpiredRowsWereDeleted(
  repositories: TestRepositories,
  oldThread: ReturnType<typeof createOldThread>,
  oldNotification: ReturnType<typeof createOldNotification>,
): Promise<void> {
  await expect(
    repositories.notificationRepository.getById(oldNotification.id),
  ).resolves.toBeUndefined()
  await expect(repositories.threadRepository.getById(oldThread.thread.id)).resolves.toBeUndefined()
  await expect(repositories.rawRepository.getByStorageKey("old")).resolves.toBeUndefined()
}
