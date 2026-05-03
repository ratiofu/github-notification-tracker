import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { openStorageDatabase } from "./database.js"
import { tmpdir } from "node:os"

const START = 0
const tempDirectories: string[] = []

export function createTempStorage(): ReturnType<typeof openStorageDatabase> {
  const directory = mkdtempSync(join(tmpdir(), "ght-storage-"))
  tempDirectories.push(directory)

  return openStorageDatabase(join(directory, "storage.sqlite"))
}

export function cleanupTempStorage(): void {
  for (const directory of tempDirectories.splice(START)) {
    rmSync(directory, { force: true, recursive: true })
  }
}
