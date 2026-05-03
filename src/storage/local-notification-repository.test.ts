import { afterEach, describe, expect, it } from "vitest"

import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js"
import { createNotificationFixture, createThreadFixture } from "../domain/fixtures.js"
import type { LocalNotification } from "../domain/notification.js"
import { LocalNotificationRepository } from "./local-notification-repository.js"
import { PullRequestThreadRepository } from "./pull-request-thread-repository.js"

describe("local notification repository", () => {
  afterEach(() => {
    cleanupTempStorage()
  })

  it("round trips notifications by ID and thread", roundTripsNotificationsByIdAndThread)
  it("updates an existing notification through upsert", updatesExistingNotification)
  it("deduplicates repeated source activity by source fingerprint", deduplicatesSourceActivity)
  it("returns undefined for missing notifications", returnsUndefinedForMissingNotifications)
  it("parses persisted JSON through the notification schema on read", parsesPersistedJsonOnRead)
})

async function roundTripsNotificationsByIdAndThread(): Promise<void> {
  const storage = createTempStorage()
  const thread = createThreadFixture()
  const notification = createNotificationFixture()
  const repository = new LocalNotificationRepository(storage.db)

  await new PullRequestThreadRepository(storage.db).upsert(thread)
  await repository.upsert(notification)

  await expect(repository.getById(notification.id)).resolves.toStrictEqual(notification)
  await expect(repository.listByThreadId(thread.thread.id)).resolves.toStrictEqual([notification])
  await storage.close()
}

async function updatesExistingNotification(): Promise<void> {
  const storage = createTempStorage()
  const repository = new LocalNotificationRepository(storage.db)
  const updatedNotification = createUpdatedNotification()

  await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture())
  await repository.upsert(createNotificationFixture())
  await repository.upsert(updatedNotification)

  await expect(repository.getById(updatedNotification.id)).resolves.toStrictEqual(
    updatedNotification,
  )
  await storage.close()
}

async function deduplicatesSourceActivity(): Promise<void> {
  const storage = createTempStorage()
  const repository = new LocalNotificationRepository(storage.db)
  const originalNotification = createNotificationFixture()
  const repeatedNotification = createRepeatedNotification(originalNotification)
  const expectedNotification = createExpectedDeduplicatedNotification(
    originalNotification,
    repeatedNotification,
  )

  await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture())
  await repository.upsert(originalNotification)
  await repository.upsert(repeatedNotification)

  await expect(repository.getById(originalNotification.id)).resolves.toStrictEqual(
    expectedNotification,
  )
  await expect(repository.getById(repeatedNotification.id)).resolves.toBeUndefined()
  await expect(repository.listByThreadId(originalNotification.threadId)).resolves.toStrictEqual([
    expectedNotification,
  ])
  await storage.close()
}

async function returnsUndefinedForMissingNotifications(): Promise<void> {
  const storage = createTempStorage()

  await expect(
    new LocalNotificationRepository(storage.db).getById("missingNotification"),
  ).resolves.toBeUndefined()
  await storage.close()
}

async function parsesPersistedJsonOnRead(): Promise<void> {
  const storage = createTempStorage()
  const notification = createNotificationFixture()
  const repository = new LocalNotificationRepository(storage.db)

  await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture())
  await repository.upsert(notification)
  storage.db
    .prepare("UPDATE local_notifications SET payload_json = ? WHERE id = ?")
    .run(JSON.stringify({ id: notification.id }), notification.id)

  await expect(repository.getById(notification.id)).rejects.toThrow("Invalid input")
  await storage.close()
}

function createUpdatedNotification(): LocalNotification {
  return {
    ...createNotificationFixture(),
    isRead: true,
    readAt: "2026-05-01T00:11:00.000Z",
    text: "Updated comment text",
    title: "Updated notification",
  }
}

function createRepeatedNotification(originalNotification: LocalNotification): LocalNotification {
  return {
    ...originalNotification,
    createdAt: "2026-05-01T00:20:00.000Z",
    id: "localNotification0002",
    text: "Repeated poll payload",
    title: "Repeated source activity",
  }
}

function createExpectedDeduplicatedNotification(
  originalNotification: LocalNotification,
  repeatedNotification: LocalNotification,
): LocalNotification {
  return {
    ...repeatedNotification,
    id: originalNotification.id,
  }
}
