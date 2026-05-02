import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ConfigFileAdapter } from "./types.js";

export function createNodeConfigFileAdapter(): ConfigFileAdapter {
  return {
    async readTextFile(path) {
      try {
        return await readFile(path, "utf8");
      } catch (error) {
        if (isNodeErrorWithCode(error, "ENOENT")) {
          return undefined;
        }

        throw error;
      }
    },
    async writeTextFile(path, content) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, "utf8");
    },
  };
}

function isNodeErrorWithCode(
  error: unknown,
  code: NodeJS.ErrnoException["code"],
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
