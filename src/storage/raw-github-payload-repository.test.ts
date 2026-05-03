import { afterEach, describe, expect, it } from "vitest"

import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js"
import type { RawGitHubPayload } from "../domain/shared.js"
import { RawGitHubPayloadRepository } from "./raw-github-payload-repository.js"
import { createRawPayloadFixture } from "../domain/fixtures.js"

const STORAGE_KEY = "pulls/42/comment/1"
const UPDATED_PAYLOAD_ID = 1

describe("raw GitHub payload repository", () => {
  afterEach(() => {
    cleanupTempStorage()
  })

  it("round trips raw payloads by storage key", roundTripsRawPayloadsByStorageKey)
  it("updates an existing raw payload through upsert", updatesExistingRawPayload)
  it("returns undefined for missing raw payloads", returnsUndefinedForMissingPayloads)
  it("parses persisted JSON through the raw payload schema on read", parsesPersistedJsonOnRead)
})

async function roundTripsRawPayloadsByStorageKey() {
  const storage = createTempStorage()
  const repository = new RawGitHubPayloadRepository(storage.db)
  const payload = createRawPayloadFixture()

  await repository.upsert(STORAGE_KEY, payload)

  await expect(repository.getByStorageKey(STORAGE_KEY)).resolves.toStrictEqual(payload)
  await storage.close()
}

async function updatesExistingRawPayload() {
  const storage = createTempStorage()
  const repository = new RawGitHubPayloadRepository(storage.db)
  const updatedPayload = createUpdatedPayload()

  await repository.upsert(STORAGE_KEY, createRawPayloadFixture())
  await repository.upsert(STORAGE_KEY, updatedPayload)

  await expect(repository.getByStorageKey(STORAGE_KEY)).resolves.toStrictEqual(updatedPayload)
  await storage.close()
}

async function returnsUndefinedForMissingPayloads() {
  const storage = createTempStorage()

  await expect(
    new RawGitHubPayloadRepository(storage.db).getByStorageKey("missing"),
  ).resolves.toBeUndefined()
  await storage.close()
}

async function parsesPersistedJsonOnRead() {
  const storage = createTempStorage()
  const repository = new RawGitHubPayloadRepository(storage.db)

  await repository.upsert(STORAGE_KEY, createRawPayloadFixture())
  storage.db
    .prepare("UPDATE raw_github_payloads SET payload_json = ? WHERE storage_key = ?")
    .run(JSON.stringify({ id: "1" }), STORAGE_KEY)

  await expect(repository.getByStorageKey(STORAGE_KEY)).rejects.toThrow("Invalid input")
  await storage.close()
}

function createUpdatedPayload(): RawGitHubPayload {
  return {
    ...createRawPayloadFixture(),
    payload: {
      body: "Updated body",
      id: UPDATED_PAYLOAD_ID,
    },
  }
}
