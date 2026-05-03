import { describe, expect, it } from "vitest"

import { getDefaultConfigPaths } from "./default-paths.js"

describe("default config paths", () => {
  it("returns config and dotenv paths under the ght config directory", () => {
    expect(getDefaultConfigPaths("/home/alice")).toStrictEqual({
      configPath: "/home/alice/.config/ght/config.yaml",
      dotenvPath: "/home/alice/.config/ght/.env",
    })
  })
})
