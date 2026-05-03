import { describe, expect, it, vi } from "vitest"

describe("cli entry", () => {
  it("prints the scaffold CLI message", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await import("./index.js")

    expect(write).toHaveBeenCalledWith("ght scaffold ready\n")
    write.mockRestore()
  })
})
