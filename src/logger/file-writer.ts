import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { LogFileWriter } from "./types.js";

export function createNodeLogFileWriter(): LogFileWriter {
  return {
    async appendTextFile(path, content) {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, content, "utf8");
    },
  };
}
