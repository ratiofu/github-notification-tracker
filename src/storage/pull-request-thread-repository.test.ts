import { afterEach, describe, expect, it } from "vitest"

import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js"
import type { PullRequestThread } from "../domain/notification-thread.js"
import { PullRequestThreadRepository } from "./pull-request-thread-repository.js"
import { createThreadFixture } from "../domain/fixtures.js"

describe("pull request thread repository", () => {
  afterEach(() => {
    cleanupTempStorage()
  })

  it("round trips threads by ID and repo", roundTripsThreadsByIdAndRepo)
  it("updates an existing thread through upsert", updatesExistingThreadThroughUpsert)
  it("preserves existing notification IDs during partial thread upserts", preservesNotificationIds)
  it("returns undefined for missing threads", returnsUndefinedForMissingThreads)
  it("parses persisted JSON through the thread schema on read", parsesPersistedJsonOnRead)
})

async function roundTripsThreadsByIdAndRepo(): Promise<void> {
  const storage = createTempStorage()
  const repository = new PullRequestThreadRepository(storage.db)
  const thread = createThreadFixture()

  await repository.upsert(thread)

  await expect(repository.getById(thread.thread.id)).resolves.toStrictEqual(thread)
  await expect(repository.listByRepo("acme/widgets")).resolves.toStrictEqual([thread])
  await storage.close()
}

async function updatesExistingThreadThroughUpsert(): Promise<void> {
  const storage = createTempStorage()
  const repository = new PullRequestThreadRepository(storage.db)
  const originalThread = createThreadFixture()
  const updatedThread: PullRequestThread = createUpdatedThread(originalThread)

  await repository.upsert(originalThread)
  await repository.upsert(updatedThread)

  await expect(repository.getById(updatedThread.thread.id)).resolves.toStrictEqual(updatedThread)
  await storage.close()
}

async function preservesNotificationIds(): Promise<void> {
  const storage = createTempStorage()
  const repository = new PullRequestThreadRepository(storage.db)
  const originalThread = createThreadFixture({
    notificationIds: ["ln00000000000001", "ln00000000000002"],
  })
  const partialUpdate = createPartialThreadUpdate(originalThread)
  const expectedThread = createExpectedMergedThread(partialUpdate)

  await repository.upsert(originalThread)
  await repository.upsert(partialUpdate)

  await expect(repository.getById(originalThread.thread.id)).resolves.toStrictEqual(expectedThread)
  await storage.close()
}

async function returnsUndefinedForMissingThreads(): Promise<void> {
  const storage = createTempStorage()

  await expect(
    new PullRequestThreadRepository(storage.db).getById("missing"),
  ).resolves.toBeUndefined()
  await storage.close()
}

async function parsesPersistedJsonOnRead(): Promise<void> {
  const storage = createTempStorage()
  const repository = new PullRequestThreadRepository(storage.db)
  const thread = createThreadFixture()

  await repository.upsert(thread)
  storage.db
    .prepare("UPDATE notification_threads SET payload_json = ? WHERE id = ?")
    .run(JSON.stringify({ thread: { id: thread.thread.id } }), thread.thread.id)

  await expect(repository.getById(thread.thread.id)).rejects.toThrow("Invalid input")
  await storage.close()
}

function createPartialThreadUpdate(originalThread: PullRequestThread): PullRequestThread {
  return {
    ...originalThread,
    notificationIds: ["ln00000000000003"],
    thread: {
      ...originalThread.thread,
      sourceUpdatedAt: "2026-05-01T00:20:00.000Z",
    },
  }
}

function createExpectedMergedThread(partialUpdate: PullRequestThread): PullRequestThread {
  return {
    ...partialUpdate,
    notificationIds: ["ln00000000000001", "ln00000000000002", "ln00000000000003"],
  }
}

function createUpdatedThread(originalThread: PullRequestThread): PullRequestThread {
  return {
    ...originalThread,
    notificationIds: ["ln00000000000001", "ln00000000000002"],
    pullRequest: {
      ...originalThread.pullRequest,
      title: "Updated PR title",
    },
    thread: {
      ...originalThread.thread,
      sourceUpdatedAt: "2026-05-01T00:10:00.000Z",
      title: "Updated PR title",
    },
  }
}
