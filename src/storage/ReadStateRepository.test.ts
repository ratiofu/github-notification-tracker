import { afterEach, describe, expect, it } from "vitest";

import { createNotificationFixture, createThreadFixture } from "../domain/fixtures.js";
import { LocalNotificationRepository } from "./LocalNotificationRepository.js";
import { PullRequestThreadRepository } from "./PullRequestThreadRepository.js";
import { ReadStateRepository } from "./ReadStateRepository.js";
import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js";

afterEach(() => {
  cleanupTempStorage();
});

describe("ReadStateRepository", () => {
  it("round trips unread null read state", async () => {
    const storage = createTempStorage();
    const repository = new ReadStateRepository(storage.db);

    await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture());
    await new LocalNotificationRepository(storage.db).upsert(createNotificationFixture());
    await repository.set({
      isRead: false,
      notificationId: "localNotification0001",
      readAt: null,
    });

    await expect(repository.get("localNotification0001")).resolves.toEqual({
      isRead: false,
      notificationId: "localNotification0001",
      readAt: null,
    });
    await storage.close();
  });

  it("updates an existing read state through set", async () => {
    const storage = createTempStorage();
    const repository = new ReadStateRepository(storage.db);

    await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture());
    await new LocalNotificationRepository(storage.db).upsert(createNotificationFixture());
    await repository.set({
      isRead: false,
      notificationId: "localNotification0001",
      readAt: null,
    });
    await repository.set({
      isRead: true,
      notificationId: "localNotification0001",
      readAt: "2026-05-01T00:12:00.000Z",
    });

    await expect(repository.get("localNotification0001")).resolves.toEqual({
      isRead: true,
      notificationId: "localNotification0001",
      readAt: "2026-05-01T00:12:00.000Z",
    });
    await storage.close();
  });

  it("returns undefined for missing read states", async () => {
    const storage = createTempStorage();

    await expect(
      new ReadStateRepository(storage.db).get("missingNotification"),
    ).resolves.toBeUndefined();
    await storage.close();
  });

  it("uses STRICT tables to reject unexpected column types", async () => {
    const storage = createTempStorage();
    const notification = createNotificationFixture();

    await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture());
    await new LocalNotificationRepository(storage.db).upsert(notification);
    await new ReadStateRepository(storage.db).set({
      isRead: true,
      notificationId: notification.id,
      readAt: "2026-05-01T00:05:00.000Z",
    });

    expect(() =>
      storage.db
        .prepare("UPDATE read_states SET is_read = 'yes' WHERE notification_id = ?")
        .run(notification.id),
    ).toThrow(
      /cannot store TEXT value in INTEGER column read_states\.is_read|cannot store TEXT value in INTEGER column/,
    );
    await storage.close();
  });
});
