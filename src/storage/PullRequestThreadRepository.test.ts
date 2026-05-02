import { afterEach, describe, expect, it } from "vitest";

import { createThreadFixture } from "../domain/fixtures.js";
import type { PullRequestThread } from "../domain/index.js";
import { PullRequestThreadRepository } from "./PullRequestThreadRepository.js";
import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js";

afterEach(() => {
  cleanupTempStorage();
});

describe("PullRequestThreadRepository", () => {
  it("round trips threads by ID and repo", async () => {
    const storage = createTempStorage();
    const repository = new PullRequestThreadRepository(storage.db);
    const thread = createThreadFixture();

    await repository.upsert(thread);

    await expect(repository.getById(thread.thread.id)).resolves.toEqual(thread);
    await expect(repository.listByRepo("acme/widgets")).resolves.toEqual([thread]);
    await storage.close();
  });

  it("updates an existing thread through upsert", async () => {
    const storage = createTempStorage();
    const repository = new PullRequestThreadRepository(storage.db);
    const originalThread = createThreadFixture();
    const updatedThread: PullRequestThread = {
      ...originalThread,
      notificationIds: ["localNotification0001", "localNotification0002"],
      pullRequest: {
        ...originalThread.pullRequest,
        title: "Updated PR title",
      },
      thread: {
        ...originalThread.thread,
        sourceUpdatedAt: "2026-05-01T00:10:00.000Z",
        title: "Updated PR title",
      },
    };

    await repository.upsert(originalThread);
    await repository.upsert(updatedThread);

    await expect(repository.getById(updatedThread.thread.id)).resolves.toEqual(updatedThread);
    await storage.close();
  });

  it("returns undefined for missing threads", async () => {
    const storage = createTempStorage();

    await expect(
      new PullRequestThreadRepository(storage.db).getById("missing"),
    ).resolves.toBeUndefined();
    await storage.close();
  });

  it("parses persisted JSON through the thread schema on read", async () => {
    const storage = createTempStorage();
    const repository = new PullRequestThreadRepository(storage.db);
    const thread = createThreadFixture();

    await repository.upsert(thread);
    storage.db
      .prepare("UPDATE notification_threads SET payload_json = ? WHERE id = ?")
      .run(JSON.stringify({ thread: { id: thread.thread.id } }), thread.thread.id);

    await expect(repository.getById(thread.thread.id)).rejects.toThrow();
    await storage.close();
  });
});
