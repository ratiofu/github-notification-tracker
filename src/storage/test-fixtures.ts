import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openStorageDatabase, type StorageDatabase } from "./database.js";

const tempDirectories: string[] = [];

export function createTempStorage(): StorageDatabase {
  const directory = mkdtempSync(join(tmpdir(), "ght-storage-"));
  tempDirectories.push(directory);

  return openStorageDatabase(join(directory, "storage.sqlite"));
}

export function cleanupTempStorage(): void {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
}
