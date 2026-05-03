import { defineConfig } from "vitest/config"

const COVERAGE_THRESHOLD = 90

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        branches: COVERAGE_THRESHOLD,
        lines: COVERAGE_THRESHOLD,
      },
    },
    globals: true,
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
})
