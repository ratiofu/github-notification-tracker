import { describe, expect, it } from "vitest"
import { LocalNotificationIdSchema } from "../domain/shared.js"
import { createLocalNotificationId } from "./local-notification-id.js"

describe("local notification IDs", () => {
  it("returns valid local notification IDs", () => {
    expect(LocalNotificationIdSchema.safeParse(createLocalNotificationId())).toMatchObject({
      success: true,
    })
  })
})
