import { describe, expect, it, vi } from "vitest";

describe("cli entry", () => {
  it("prints the scaffold CLI message", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await import("./index.js");

    expect(log).toHaveBeenCalledWith("ght scaffold ready");
    log.mockRestore();
  });
});
