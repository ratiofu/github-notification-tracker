import { homedir } from "node:os";
import { join } from "node:path";

import type { ConfigPaths } from "./types.js";

export function getDefaultConfigPaths(homeDirectory = homedir()): ConfigPaths {
  const configDirectory = join(homeDirectory, ".config", "ght");

  return {
    configPath: join(configDirectory, "config.yaml"),
    dotenvPath: join(configDirectory, ".env"),
  };
}
