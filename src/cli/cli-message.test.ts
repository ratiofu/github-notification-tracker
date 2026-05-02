import { describe, expect, it } from "vitest";

import { createCliMessage } from "./cli-message.js";

describe("createCliMessage", () => {
  it("returns the scaffold CLI message", () => {
    expect(createCliMessage()).toBe("ght scaffold ready");
  });
});
