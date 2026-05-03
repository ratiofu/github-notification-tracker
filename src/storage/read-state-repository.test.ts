import { afterEach, describe, expect, it } from "vitest"

import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js"
import { createNotificationFixture, createThreadFixture } from "../domain/fixtures.js"
import { LocalNotificationRepository } from "./local-notification-repository.js"
import { PullRequestThreadRepository } from "./pull-request-thread-repository.js"
import { ReadStateRepository } from "./read-state-repository.js"

const LOCAL_NOTIFICATION_ID = "ln00000000000001"
const READ_AT = "2026-05-01T00:12:00.000Z"
const STRICT_TYPE_ERROR =
  /cannot store TEXT value in INTEGER column read_states\.is_read|cannot store TEXT value in INTEGER column/

describe("read state repository", () => {
  afterEach(() => {
    cleanupTempStorage()
  })

  it("round trips unread null read state", roundTripsUnreadNullReadState)
  it("updates an existing read state through set", updatesExistingReadState)
  it("returns undefined for missing read states", returnsUndefinedForMissingReadStates)
  it("uses STRICT tables to reject unexpected column types", rejectsUnexpectedColumnTypes)
})

async function roundTripsUnreadNullReadState(): Promise<void> {
  const storage = createTempStorage()
  const repository = new ReadStateRepository(storage.db)

  await seedNotification(storage.db)
  await repository.set({
    isRead: false,
    notificationId: LOCAL_NOTIFICATION_ID,
    readAt: null,
  })

  await expect(repository.get(LOCAL_NOTIFICATION_ID)).resolves.toStrictEqual({
    isRead: false,
    notificationId: LOCAL_NOTIFICATION_ID,
    readAt: null,
  })
  await storage.close()
}

async function updatesExistingReadState(): Promise<void> {
  const storage = createTempStorage()
  const repository = new ReadStateRepository(storage.db)

  await seedNotification(storage.db)
  await repository.set({
    isRead: false,
    notificationId: LOCAL_NOTIFICATION_ID,
    readAt: null,
  })
  await repository.set({
    isRead: true,
    notificationId: LOCAL_NOTIFICATION_ID,
    readAt: READ_AT,
  })

  await expect(repository.get(LOCAL_NOTIFICATION_ID)).resolves.toStrictEqual({
    isRead: true,
    notificationId: LOCAL_NOTIFICATION_ID,
    readAt: READ_AT,
  })
  await storage.close()
}

async function returnsUndefinedForMissingReadStates(): Promise<void> {
  const storage = createTempStorage()

  await expect(
    new ReadStateRepository(storage.db).get("missingNotif00001"),
  ).resolves.toBeUndefined()
  await storage.close()
}

async function rejectsUnexpectedColumnTypes(): Promise<void> {
  const storage = createTempStorage()
  const notification = createNotificationFixture()

  await seedNotification(storage.db, notification)
  await new ReadStateRepository(storage.db).set({
    isRead: true,
    notificationId: notification.id,
    readAt: "2026-05-01T00:05:00.000Z",
  })

  expect(() =>
    storage.db
      .prepare("UPDATE read_states SET is_read = 'yes' WHERE notification_id = ?")
      .run(notification.id),
  ).toThrow(STRICT_TYPE_ERROR)
  await storage.close()
}

async function seedNotification(
  db: ReturnType<typeof createTempStorage>["db"],
  notification = createNotificationFixture(),
): Promise<void> {
  await new PullRequestThreadRepository(db).upsert(createThreadFixture())
  await new LocalNotificationRepository(db).upsert(notification)
}
