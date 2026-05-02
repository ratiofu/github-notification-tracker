import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { DailyJsonlLogger } from "./DailyJsonlLogger.js";
import { createNodeLogFileWriter } from "./file-writer.js";
import type { LogFileWriter } from "./types.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("DailyJsonlLogger", () => {
  it("stamps and appends boundary-validated events to the current daily file", async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const logger = new DailyJsonlLogger({
      directory: "/logs",
      now: () => new Date("2026-05-02T12:34:56.789Z"),
      writer: createMemoryWriter(writes),
    });

    const event = await logger.log({
      data: { repo: "acme/widgets" },
      event: "poll_started",
      level: "info",
      message: "Polling started",
    });

    expect(event).toEqual({
      data: { repo: "acme/widgets" },
      event: "poll_started",
      level: "info",
      message: "Polling started",
      timestamp: "2026-05-02T12:34:56.789Z",
    });
    expect(writes).toEqual([
      {
        content: `${JSON.stringify(event)}\n`,
        path: "/logs/2026-05-02.jsonl",
      },
    ]);
  });

  it("uses an explicit event timestamp to choose the daily file", async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const logger = new DailyJsonlLogger({
      directory: "/logs",
      now: () => new Date("2026-05-02T12:34:56.789Z"),
      writer: createMemoryWriter(writes),
    });

    await logger.log({
      event: "team_sync_failed",
      level: "warn",
      timestamp: "2026-05-01T23:59:59.000Z",
    });

    expect(writes).toHaveLength(1);
    expect(writes[0]?.path).toBe("/logs/2026-05-01.jsonl");
  });

  it("rejects invalid log events before writing", async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const logger = new DailyJsonlLogger({
      directory: "/logs",
      writer: createMemoryWriter(writes),
    });

    await expect(
      logger.log({
        event: "",
        level: "info",
      }),
    ).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it("creates parent directories and appends with the Node writer", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ght-logs-"));
    tempDirectories.push(directory);
    const logger = new DailyJsonlLogger({
      directory: join(directory, "nested", "logs"),
      now: () => new Date("2026-05-02T12:34:56.789Z"),
      writer: createNodeLogFileWriter(),
    });

    await logger.log({ event: "poll_started", level: "info" });
    await logger.log({ event: "poll_finished", level: "info" });

    const logFile = await readFile(join(directory, "nested", "logs", "2026-05-02.jsonl"), "utf8");

    expect(logFile.trim().split("\n")).toHaveLength(2);
    expect(JSON.parse(logFile.trim().split("\n")[1] ?? "{}")).toMatchObject({
      event: "poll_finished",
    });
  });
});

function createMemoryWriter(writes: Array<{ path: string; content: string }>): LogFileWriter {
  return {
    async appendTextFile(path, content) {
      writes.push({ content, path });
    },
  };
}
