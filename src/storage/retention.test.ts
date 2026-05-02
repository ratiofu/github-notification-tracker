import { afterEach, describe, expect, it } from "vitest";

import {
  createNotificationFixture,
  createRawPayloadFixture,
  createThreadFixture,
} from "../domain/fixtures.js";
import { LocalNotificationRepository } from "./LocalNotificationRepository.js";
import { PullRequestThreadRepository } from "./PullRequestThreadRepository.js";
import { RawGitHubPayloadRepository } from "./RawGitHubPayloadRepository.js";
import { ReadStateRepository } from "./ReadStateRepository.js";
import { pruneStorageByRetention } from "./retention.js";
import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js";

afterEach(() => {
  cleanupTempStorage();
});

describe("pruneStorageByRetention", () => {
  it("rolls back retention pruning when a delete fails", async () => {
    const storage = createTempStorage();
    const threadRepository = new PullRequestThreadRepository(storage.db);
    const notificationRepository = new LocalNotificationRepository(storage.db);
    const readStateRepository = new ReadStateRepository(storage.db);
    const oldThread = createThreadFixture({
      id: "pr:acme/widgets:41",
      notificationIds: ["oldNotification000001"],
      number: 41,
      sourceUpdatedAt: "2026-04-01T00:00:00.000Z",
    });
    const oldNotification = createNotificationFixture({
      createdAt: "2026-04-01T00:00:00.000Z",
      id: "oldNotification000001",
      sourceFingerprint: "comment:old",
      sourceTimestamp: "2026-04-01T00:00:00.000Z",
      thread: oldThread,
    });

    await threadRepository.upsert(oldThread);
    await notificationRepository.upsert(oldNotification);
    await readStateRepository.set({
      isRead: true,
      notificationId: oldNotification.id,
      readAt: "2026-04-01T00:10:00.000Z",
    });
    storage.db.exec("DROP TABLE raw_github_payloads");

    await expect(pruneStorageByRetention(storage.db, "2026-05-01T00:00:00.000Z")).rejects.toThrow();
    await expect(notificationRepository.getById(oldNotification.id)).resolves.toEqual(
      oldNotification,
    );
    await expect(threadRepository.getById(oldThread.thread.id)).resolves.toEqual(oldThread);
    await expect(readStateRepository.get(oldNotification.id)).resolves.toEqual({
      isRead: true,
      notificationId: oldNotification.id,
      readAt: "2026-04-01T00:10:00.000Z",
    });
    await storage.close();
  });

  it("prunes old notifications, raw payloads, read states, and empty threads", async () => {
    const storage = createTempStorage();
    const threadRepository = new PullRequestThreadRepository(storage.db);
    const notificationRepository = new LocalNotificationRepository(storage.db);
    const rawRepository = new RawGitHubPayloadRepository(storage.db);
    const readStateRepository = new ReadStateRepository(storage.db);
    const oldThread = createThreadFixture({
      id: "pr:acme/widgets:41",
      notificationIds: ["oldNotification000001"],
      number: 41,
      sourceUpdatedAt: "2026-04-01T00:00:00.000Z",
    });
    const newThread = createThreadFixture();
    const oldNotification = createNotificationFixture({
      createdAt: "2026-04-01T00:00:00.000Z",
      id: "oldNotification000001",
      sourceFingerprint: "comment:old",
      sourceTimestamp: "2026-04-01T00:00:00.000Z",
      thread: oldThread,
    });
    const newNotification = createNotificationFixture({ thread: newThread });

    await threadRepository.upsert(oldThread);
    await threadRepository.upsert(newThread);
    await notificationRepository.upsert(oldNotification);
    await notificationRepository.upsert(newNotification);
    await readStateRepository.set({
      isRead: true,
      notificationId: oldNotification.id,
      readAt: "2026-04-01T00:10:00.000Z",
    });
    await rawRepository.upsert("old", {
      ...createRawPayloadFixture(),
      fetchedAt: "2026-04-01T00:00:00.000Z",
      id: "old",
    });
    await rawRepository.upsert("new", createRawPayloadFixture());

    const result = await pruneStorageByRetention(storage.db, "2026-05-01T00:00:00.000Z");

    expect(result).toEqual({
      deletedNotifications: 1,
      deletedRawPayloads: 1,
      deletedReadStates: 0,
      deletedThreads: 1,
    });
    await expect(notificationRepository.getById(oldNotification.id)).resolves.toBeUndefined();
    await expect(notificationRepository.getById(newNotification.id)).resolves.toEqual(
      newNotification,
    );
    await expect(threadRepository.getById(oldThread.thread.id)).resolves.toBeUndefined();
    await expect(rawRepository.getByStorageKey("old")).resolves.toBeUndefined();
    await expect(rawRepository.getByStorageKey("new")).resolves.toEqual(createRawPayloadFixture());
    await storage.close();
  });
});
