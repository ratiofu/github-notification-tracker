import { describe, expect, it } from "vitest"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { createNodeConfigFileAdapter } from "./file-adapter.js"
import { join } from "node:path"
import { tmpdir } from "node:os"

const CONFIG_TEXT = "repo: acme/widgets\n"
const READ_DIRECTORY_ERROR = /EISDIR|illegal operation on a directory/u

describe("node config file adapter", () => {
  it("returns undefined for missing files", returnsUndefinedForMissingFiles)
  it("writes parent directories before reading text files", writesParentDirectories)
  it("rethrows non-missing read errors", rethrowsNonMissingReadErrors)
})

async function returnsUndefinedForMissingFiles(): Promise<void> {
  const tempDirectory = await createTempDirectory()

  try {
    const adapter = createNodeConfigFileAdapter()

    await expect(adapter.readTextFile(join(tempDirectory, "missing.yaml"))).resolves.toBeUndefined()
  } finally {
    await cleanupDirectory(tempDirectory)
  }
}

async function writesParentDirectories(): Promise<void> {
  const tempDirectory = await createTempDirectory()

  try {
    const adapter = createNodeConfigFileAdapter()
    const path = join(tempDirectory, "nested", "config.yaml")

    await adapter.writeTextFile(path, CONFIG_TEXT)

    await expect(adapter.readTextFile(path)).resolves.toBe(CONFIG_TEXT)
  } finally {
    await cleanupDirectory(tempDirectory)
  }
}

async function rethrowsNonMissingReadErrors(): Promise<void> {
  const tempDirectory = await createTempDirectory()

  try {
    const adapter = createNodeConfigFileAdapter()
    const directoryPath = join(tempDirectory, "directory")
    await mkdir(directoryPath)

    await expect(adapter.readTextFile(directoryPath)).rejects.toThrow(READ_DIRECTORY_ERROR)
  } finally {
    await cleanupDirectory(tempDirectory)
  }
}

async function createTempDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "ght-config-"))

  return path
}

async function cleanupDirectory(path: string): Promise<void> {
  await rm(path, { force: true, recursive: true })
}
