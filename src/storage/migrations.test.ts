import { afterEach, describe, expect, it } from "vitest"
import { cleanupTempStorage, createTempStorage } from "./test-fixtures.js"
import { DatabaseSync } from "node:sqlite"
import { migrateDatabase } from "./migrations.js"
import { openStorageDatabase } from "./database.js"

const CURRENT_SCHEMA_VERSION = 1

describe("SQLite migrations", () => {
  afterEach(() => {
    cleanupTempStorage()
  })

  it("opens an in-memory database for isolated callers", opensInMemoryDatabase)
  it("applies migrations once and records versions", appliesMigrationsOnce)
  it("rejects an invalid migration version row", rejectsInvalidMigrationVersionRow)
})

async function opensInMemoryDatabase(): Promise<void> {
  const storage = openStorageDatabase(":memory:")

  expect(readMigrationVersions(storage.db)).toStrictEqual([CURRENT_SCHEMA_VERSION])
  await storage.close()
}

async function appliesMigrationsOnce(): Promise<void> {
  const storage = createTempStorage()

  migrateDatabase(storage.db, "2026-05-01T00:00:00.000Z")

  expect(readMigrationVersions(storage.db)).toStrictEqual([CURRENT_SCHEMA_VERSION])
  await storage.close()
}

function rejectsInvalidMigrationVersionRow(): void {
  const db = new DatabaseSync(":memory:")
  db.exec(`
    CREATE TABLE schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    INSERT INTO schema_migrations (version, applied_at)
    VALUES ('one', '2026-05-01T00:00:00.000Z');
  `)

  expect(() => {
    migrateDatabase(db)
  }).toThrow("SQLite row version is not a number")
  db.close()
}

function readMigrationVersions(db: DatabaseSync): readonly number[] {
  return db
    .prepare("SELECT version FROM schema_migrations")
    .all()
    .map((row) => readRowNumber(row, "version"))
}

function readRowNumber(row: unknown, key: string): number {
  if (typeof row !== "object" || row === null) {
    throw new TypeError("SQLite row is not an object")
  }

  const value = (row as Record<string, unknown>)[key]

  if (typeof value !== "number") {
    throw new TypeError(`SQLite row ${key} is not a number`)
  }

  return value
}
