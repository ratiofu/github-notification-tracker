import { afterEach, describe, expect, it } from "vitest";

import { createRawPayloadFixture } from "../domain/fixtures.js";
import type { RawGitHubPayload } from "../domain/index.js";
import { RawGitHubPayloadRepository } from "./RawGitHubPayloadRepository.js";
import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js";

afterEach(() => {
  cleanupTempStorage();
});

describe("RawGitHubPayloadRepository", () => {
  it("round trips raw payloads by storage key", async () => {
    const storage = createTempStorage();
    const repository = new RawGitHubPayloadRepository(storage.db);
    const payload = createRawPayloadFixture();

    await repository.upsert("pulls/42/comment/1", payload);

    await expect(repository.getByStorageKey("pulls/42/comment/1")).resolves.toEqual(payload);
    await storage.close();
  });

  it("updates an existing raw payload through upsert", async () => {
    const storage = createTempStorage();
    const repository = new RawGitHubPayloadRepository(storage.db);
    const updatedPayload: RawGitHubPayload = {
      ...createRawPayloadFixture(),
      payload: {
        body: "Updated body",
        id: 1,
      },
    };

    await repository.upsert("pulls/42/comment/1", createRawPayloadFixture());
    await repository.upsert("pulls/42/comment/1", updatedPayload);

    await expect(repository.getByStorageKey("pulls/42/comment/1")).resolves.toEqual(updatedPayload);
    await storage.close();
  });

  it("returns undefined for missing raw payloads", async () => {
    const storage = createTempStorage();

    await expect(
      new RawGitHubPayloadRepository(storage.db).getByStorageKey("missing"),
    ).resolves.toBeUndefined();
    await storage.close();
  });

  it("parses persisted JSON through the raw payload schema on read", async () => {
    const storage = createTempStorage();
    const repository = new RawGitHubPayloadRepository(storage.db);

    await repository.upsert("pulls/42/comment/1", createRawPayloadFixture());
    storage.db
      .prepare("UPDATE raw_github_payloads SET payload_json = ? WHERE storage_key = ?")
      .run(JSON.stringify({ id: "1" }), "pulls/42/comment/1");

    await expect(repository.getByStorageKey("pulls/42/comment/1")).rejects.toThrow();
    await storage.close();
  });
});
