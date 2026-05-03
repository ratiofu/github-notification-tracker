import { DatabaseSync } from "node:sqlite"
import { dirname } from "node:path"
import { migrateDatabase } from "./migrations.js"
import { mkdirSync } from "node:fs"
import { settleSynchronousStatement } from "./db-util.js"

export interface StorageDatabase {
  readonly db: DatabaseSync
  close(): Promise<void>
}

/** Opens the app database and ensures the schema is ready before repositories use it. */
export function openStorageDatabase(path: string): StorageDatabase {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new DatabaseSync(path)
  db.exec("PRAGMA foreign_keys = ON")
  migrateDatabase(db)

  return {
    async close() {
      db.close()
      await settleSynchronousStatement()
    },
    db,
  }
}
