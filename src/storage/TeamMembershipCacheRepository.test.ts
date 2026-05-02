import { afterEach, describe, expect, it } from "vitest";

import { createTeamEntryFixture } from "../domain/fixtures.js";
import type { TeamMembershipCacheEntry } from "../domain/index.js";
import { TeamMembershipCacheRepository } from "./TeamMembershipCacheRepository.js";
import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js";

afterEach(() => {
  cleanupTempStorage();
});

describe("TeamMembershipCacheRepository", () => {
  it("round trips team cache entries by repo", async () => {
    const storage = createTempStorage();
    const repository = new TeamMembershipCacheRepository(storage.db);
    const teamEntry = createTeamEntryFixture();

    await repository.upsert("acme/widgets", teamEntry);

    await expect(repository.listByRepo("acme/widgets")).resolves.toEqual({
      entries: [teamEntry],
      repo: "acme/widgets",
    });
    await storage.close();
  });

  it("updates an existing team cache entry through upsert", async () => {
    const storage = createTempStorage();
    const repository = new TeamMembershipCacheRepository(storage.db);
    const updatedTeamEntry: TeamMembershipCacheEntry = {
      ...createTeamEntryFixture(),
      members: ["tj"],
      syncedAt: "2026-05-01T00:15:00.000Z",
      team: {
        ...createTeamEntryFixture().team,
        members: ["tj"],
      },
    };

    await repository.upsert("acme/widgets", createTeamEntryFixture());
    await repository.upsert("acme/widgets", updatedTeamEntry);

    await expect(repository.listByRepo("acme/widgets")).resolves.toEqual({
      entries: [updatedTeamEntry],
      repo: "acme/widgets",
    });
    await storage.close();
  });

  it("returns an empty team cache for repos without cached teams", async () => {
    const storage = createTempStorage();

    await expect(
      new TeamMembershipCacheRepository(storage.db).listByRepo("acme/widgets"),
    ).resolves.toEqual({
      entries: [],
      repo: "acme/widgets",
    });
    await storage.close();
  });

  it("parses persisted JSON through the team cache schema on read", async () => {
    const storage = createTempStorage();
    const repository = new TeamMembershipCacheRepository(storage.db);

    await repository.upsert("acme/widgets", createTeamEntryFixture());
    storage.db
      .prepare("UPDATE team_membership_cache_entries SET payload_json = ? WHERE repo = ?")
      .run(JSON.stringify({ team: { org: "acme", slug: "platform" } }), "acme/widgets");

    await expect(repository.listByRepo("acme/widgets")).rejects.toThrow();
    await storage.close();
  });
});
