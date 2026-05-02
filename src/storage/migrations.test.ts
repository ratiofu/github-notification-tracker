import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import { openStorageDatabase } from "./database.js";
import { migrateDatabase } from "./migrations.js";
import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js";

afterEach(() => {
  cleanupTempStorage();
});

describe("SQLite migrations", () => {
  it("opens an in-memory database for isolated callers", async () => {
    const storage = openStorageDatabase(":memory:");

    expect(storage.db.prepare("SELECT version FROM schema_migrations").all()).toEqual([
      { version: 1 },
    ]);
    await storage.close();
  });

  it("applies migrations once and records versions", async () => {
    const storage = createTempStorage();

    migrateDatabase(storage.db, "2026-05-01T00:00:00.000Z");
    const rows = storage.db.prepare("SELECT version FROM schema_migrations").all();

    expect(rows).toEqual([{ version: 1 }]);
    await storage.close();
  });

  it("rejects an invalid migration version row", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      INSERT INTO schema_migrations (version, applied_at)
      VALUES ('one', '2026-05-01T00:00:00.000Z');
    `);

    expect(() => migrateDatabase(db)).toThrow("SQLite row version is not a number");
    db.close();
  });
});
