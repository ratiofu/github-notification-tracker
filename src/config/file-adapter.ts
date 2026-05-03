import { mkdir, readFile, writeFile } from "node:fs/promises"
import type { ConfigFileAdapter } from "./types.js"
import { dirname } from "node:path"

const MISSING_FILE_CONTENT = undefined

export function createNodeConfigFileAdapter(): ConfigFileAdapter {
  return {
    async readTextFile(path) {
      try {
        return await readFile(path, "utf8")
      } catch (error) {
        if (isNodeErrorWithCode(error, "ENOENT")) {
          return MISSING_FILE_CONTENT
        }

        throw error
      }
    },
    async writeTextFile(path, content) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, content, "utf8")
    },
  }
}

function isNodeErrorWithCode(
  error: unknown,
  code: NodeJS.ErrnoException["code"],
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code
}
