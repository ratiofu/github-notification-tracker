import { describe, expect, it } from "vitest";

import { getDefaultConfigPaths } from "./default-paths.js";

describe("getDefaultConfigPaths", () => {
  it("returns config and dotenv paths under the ght config directory", () => {
    expect(getDefaultConfigPaths("/home/alice")).toEqual({
      configPath: "/home/alice/.config/ght/config.yaml",
      dotenvPath: "/home/alice/.config/ght/.env",
    });
  });
});
