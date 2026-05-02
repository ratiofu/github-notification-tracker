import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createNodeConfigFileAdapter } from "./file-adapter.js";

describe("createNodeConfigFileAdapter", () => {
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), "ght-config-"));
  });

  afterEach(async () => {
    await rm(tempDirectory, { force: true, recursive: true });
  });

  it("returns undefined for missing files", async () => {
    const adapter = createNodeConfigFileAdapter();

    await expect(
      adapter.readTextFile(join(tempDirectory, "missing.yaml")),
    ).resolves.toBeUndefined();
  });

  it("writes parent directories before reading text files", async () => {
    const adapter = createNodeConfigFileAdapter();
    const path = join(tempDirectory, "nested", "config.yaml");

    await adapter.writeTextFile(path, "repo: acme/widgets\n");

    await expect(adapter.readTextFile(path)).resolves.toBe("repo: acme/widgets\n");
  });

  it("rethrows non-missing read errors", async () => {
    const adapter = createNodeConfigFileAdapter();
    const directoryPath = join(tempDirectory, "directory");
    await mkdir(directoryPath);

    await expect(adapter.readTextFile(directoryPath)).rejects.toThrow();
  });
});
