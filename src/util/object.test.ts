import { describe, expect, it } from "vitest"

import { withoutUndefined } from "./object.js"

const ZERO_VALUE = 0

describe("object utilities", () => {
  it("removes undefined properties", () => {
    expect(
      withoutUndefined({
        absent: undefined,
        present: "value",
      }),
    ).toStrictEqual({
      present: "value",
    })
  })

  it("keeps null, false, zero, and empty string values", () => {
    expect(
      withoutUndefined({
        empty: "",
        falseValue: false,
        nullValue: null,
        zero: ZERO_VALUE,
      }),
    ).toStrictEqual({
      empty: "",
      falseValue: false,
      nullValue: null,
      zero: ZERO_VALUE,
    })
  })
})
