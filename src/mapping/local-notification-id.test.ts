import { describe, expect, it, vi } from "vitest"
import { LocalNotificationIdSchema } from "../domain/shared.js"
import { createLocalNotificationId } from "./local-notification-id.js"

const EXPECTED_ID_LENGTH = 16
const FIRST_INDEX = 0
const TIMESTAMP_BYTE_LENGTH = 6
const timestamp = 1_767_222_000_123

describe("local notification IDs", () => {
  it("returns valid local notification IDs", () => {
    expect(LocalNotificationIdSchema.safeParse(createLocalNotificationId())).toMatchObject({
      success: true,
    })
  })

  it("stores Date.now milliseconds in the first six bytes", () => {
    vi.spyOn(Date, "now").mockReturnValue(timestamp)

    const id = createLocalNotificationId()
    const bytes = Buffer.from(id, "base64url")

    expect(id).toHaveLength(EXPECTED_ID_LENGTH)
    expect(bytes.readUIntBE(FIRST_INDEX, TIMESTAMP_BYTE_LENGTH)).toBe(timestamp)
    vi.restoreAllMocks()
  })
})
