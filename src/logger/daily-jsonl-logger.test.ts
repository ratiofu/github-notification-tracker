import { afterEach, describe, expect, it } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { DailyJsonlLogger } from "./daily-jsonl-logger.js"
import { createNodeLogFileWriter } from "./file-writer.js"
import { join } from "node:path"
import { tmpdir } from "node:os"

const CLEANUP_START = 0
const EXPECTED_SINGLE_WRITE = 1
const EXPECTED_TWO_LOG_LINES = 2
const SECOND_LOG_LINE_INDEX = 1
const NOW = "2026-05-02T12:34:56.789Z"
const tempDirectories: string[] = []

interface MemoryWrite {
  readonly content: string
  readonly path: string
}

describe("daily JSONL logger", () => {
  afterEach(cleanupTempDirectories)

  it("stamps and appends boundary-validated events to the current daily file", appendsStampedEvents)
  it("uses an explicit event timestamp to choose the daily file", usesExplicitEventTimestamp)
  it("rejects invalid log events before writing", rejectsInvalidEventsBeforeWriting)
  it("creates parent directories and appends with the Node writer", appendsWithNodeWriter)
})

async function appendsStampedEvents(): Promise<void> {
  const writes: MemoryWrite[] = []
  const logger = createMemoryLogger(writes)

  const event = await logger.log({
    data: { repo: "acme/widgets" },
    event: "poll_started",
    level: "info",
    message: "Polling started",
  })

  expect(event).toStrictEqual({
    data: { repo: "acme/widgets" },
    event: "poll_started",
    level: "info",
    message: "Polling started",
    timestamp: NOW,
  })
  expect(writes).toStrictEqual([
    {
      content: `${JSON.stringify(event)}\n`,
      path: "/logs/2026-05-02.jsonl",
    },
  ])
}

async function usesExplicitEventTimestamp(): Promise<void> {
  const writes: MemoryWrite[] = []
  const logger = createMemoryLogger(writes)

  await logger.log({
    event: "team_sync_failed",
    level: "warn",
    timestamp: "2026-05-01T23:59:59.000Z",
  })

  expect(writes).toHaveLength(EXPECTED_SINGLE_WRITE)
  const [write] = writes
  expect(write?.path).toBe("/logs/2026-05-01.jsonl")
}

async function rejectsInvalidEventsBeforeWriting(): Promise<void> {
  const writes: MemoryWrite[] = []
  const logger = new DailyJsonlLogger({
    directory: "/logs",
    writer: createMemoryWriter(writes),
  })

  await expect(
    logger.log({
      event: "",
      level: "info",
    }),
  ).rejects.toThrow("Too small")
  expect(writes).toStrictEqual([])
}

async function appendsWithNodeWriter(): Promise<void> {
  const directory = await createTempDirectory()
  const logger = createNodeLogger(directory)

  await logger.log({ event: "poll_started", level: "info" })
  await logger.log({ event: "poll_finished", level: "info" })

  const logLines = await readLogLines(directory)

  expect(logLines).toHaveLength(EXPECTED_TWO_LOG_LINES)
  expect(JSON.parse(readRequiredLine(logLines, SECOND_LOG_LINE_INDEX))).toMatchObject({
    event: "poll_finished",
  })
}

async function cleanupTempDirectories(): Promise<void> {
  await Promise.all(
    tempDirectories.splice(CLEANUP_START).map(async (directory) => {
      await cleanupDirectory(directory)
    }),
  )
}

function createMemoryLogger(writes: MemoryWrite[]): DailyJsonlLogger {
  return new DailyJsonlLogger({
    directory: "/logs",
    now: () => new Date(NOW),
    writer: createMemoryWriter(writes),
  })
}

function createNodeLogger(directory: string): DailyJsonlLogger {
  return new DailyJsonlLogger({
    directory: join(directory, "nested", "logs"),
    now: () => new Date(NOW),
    writer: createNodeLogFileWriter(),
  })
}

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "ght-logs-"))
  tempDirectories.push(directory)

  return directory
}

async function readLogLines(directory: string): Promise<readonly string[]> {
  const logFile = await readFile(join(directory, "nested", "logs", "2026-05-02.jsonl"), "utf8")

  return logFile.trim().split("\n")
}

function createMemoryWriter(writes: MemoryWrite[]) {
  return {
    async appendTextFile(path: string, content: string) {
      writes.push({ content, path })
      await Promise.resolve()
    },
  }
}

async function cleanupDirectory(directory: string): Promise<void> {
  await rm(directory, { force: true, recursive: true })
}

function readRequiredLine(lines: readonly string[], index: number): string {
  const line = lines[index]

  if (line === undefined) {
    throw new Error(`Missing log line ${index}`)
  }

  return line
}
