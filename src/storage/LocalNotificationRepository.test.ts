import { afterEach, describe, expect, it } from "vitest";

import { createNotificationFixture, createThreadFixture } from "../domain/fixtures.js";
import type { LocalNotification } from "../domain/index.js";
import { PullRequestThreadRepository } from "./PullRequestThreadRepository.js";
import { LocalNotificationRepository } from "./LocalNotificationRepository.js";
import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js";

afterEach(() => {
  cleanupTempStorage();
});

describe("LocalNotificationRepository", () => {
  it("round trips notifications by ID and thread", async () => {
    const storage = createTempStorage();
    const thread = createThreadFixture();
    const notification = createNotificationFixture();
    const repository = new LocalNotificationRepository(storage.db);

    await new PullRequestThreadRepository(storage.db).upsert(thread);
    await repository.upsert(notification);

    await expect(repository.getById(notification.id)).resolves.toEqual(notification);
    await expect(repository.listByThreadId(thread.thread.id)).resolves.toEqual([notification]);
    await storage.close();
  });

  it("updates an existing notification through upsert", async () => {
    const storage = createTempStorage();
    const repository = new LocalNotificationRepository(storage.db);
    const updatedNotification: LocalNotification = {
      ...createNotificationFixture(),
      isRead: true,
      readAt: "2026-05-01T00:11:00.000Z",
      text: "Updated comment text",
      title: "Updated notification",
    };

    await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture());
    await repository.upsert(createNotificationFixture());
    await repository.upsert(updatedNotification);

    await expect(repository.getById(updatedNotification.id)).resolves.toEqual(updatedNotification);
    await storage.close();
  });

  it("deduplicates repeated source activity by source fingerprint", async () => {
    const storage = createTempStorage();
    const repository = new LocalNotificationRepository(storage.db);
    const originalNotification = createNotificationFixture();
    const repeatedNotification: LocalNotification = {
      ...originalNotification,
      createdAt: "2026-05-01T00:20:00.000Z",
      id: "localNotification0002",
      text: "Repeated poll payload",
      title: "Repeated source activity",
    };
    const expectedNotification: LocalNotification = {
      ...repeatedNotification,
      id: originalNotification.id,
    };

    await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture());
    await repository.upsert(originalNotification);
    await repository.upsert(repeatedNotification);

    await expect(repository.getById(originalNotification.id)).resolves.toEqual(
      expectedNotification,
    );
    await expect(repository.getById(repeatedNotification.id)).resolves.toBeUndefined();
    await expect(repository.listByThreadId(originalNotification.threadId)).resolves.toEqual([
      expectedNotification,
    ]);
    await storage.close();
  });

  it("returns undefined for missing notifications", async () => {
    const storage = createTempStorage();

    await expect(
      new LocalNotificationRepository(storage.db).getById("missingNotification"),
    ).resolves.toBeUndefined();
    await storage.close();
  });

  it("parses persisted JSON through the notification schema on read", async () => {
    const storage = createTempStorage();
    const notification = createNotificationFixture();
    const repository = new LocalNotificationRepository(storage.db);

    await new PullRequestThreadRepository(storage.db).upsert(createThreadFixture());
    await repository.upsert(notification);
    storage.db
      .prepare("UPDATE local_notifications SET payload_json = ? WHERE id = ?")
      .run(JSON.stringify({ id: notification.id }), notification.id);

    await expect(repository.getById(notification.id)).rejects.toThrow();
    await storage.close();
  });
});
