import type { ConfigPaths } from "./types.js"
import { homedir } from "node:os"
import { join } from "node:path"

export function getDefaultConfigPaths(homeDirectory = homedir()): ConfigPaths {
  const configDirectory = join(homeDirectory, ".config", "ght")

  return {
    configPath: join(configDirectory, "config.yaml"),
    dotenvPath: join(configDirectory, ".env"),
  }
}
