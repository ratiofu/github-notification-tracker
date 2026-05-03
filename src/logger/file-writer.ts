import { appendFile, mkdir } from "node:fs/promises"
import type { LogFileWriter } from "./types.js"
import { dirname } from "node:path"

export function createNodeLogFileWriter(): LogFileWriter {
  return {
    async appendTextFile(path, content) {
      await mkdir(dirname(path), { recursive: true })
      await appendFile(path, content, "utf8")
    },
  }
}
