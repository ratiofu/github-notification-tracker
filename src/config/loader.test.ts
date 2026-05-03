import { describe, expect, it } from "vitest"

import { loadConfig, loadConfigFromSources, persistRuntimeConfig } from "./loader.js"
import type { ConfigFileAdapter } from "./types.js"
import { DEFAULT_POLL_INTERVAL_SECONDS } from "../constants.js"

const ENV_POLL_INTERVAL_SECONDS = 20
const ENV_RETENTION_DAYS = 14
const INVALID_POLL_INTERVAL_SECONDS = -1
const TEAM_SYNC_INTERVAL_SECONDS = 120

describe("config loading", () => {
  it("merges config file, .env, env, and CLI by precedence", mergesConfigPrecedence)
  it("parses env participants, booleans, and process token precedence", parsesEnvOverrides)
  it("ignores blank or invalid env override values", ignoresInvalidEnvOverrides)
  it("loads YAML and .env through the file adapter", loadsThroughFileAdapter)
  it("loads when optional config files are absent", loadsWithoutOptionalFiles)
  it(
    "merges runtime config into existing YAML without materializing absent defaults",
    mergesRuntimeConfig,
  )
  it(
    "persists runtime config when the existing YAML is absent or non-object",
    persistsRuntimeConfigOnly,
  )
  it("throws when required config is absent", throwsWhenRequiredConfigIsAbsent)
  it("throws when CLI config is invalid", throwsWhenCliConfigIsInvalid)
})

function mergesConfigPrecedence(): void {
  const loaded = loadConfigFromSources(createLayeredSources())

  expect(loaded.config).toMatchObject({
    github: { patEnv: "DOTENV_PAT" },
    pollIntervalSeconds: ENV_POLL_INTERVAL_SECONDS,
    repo: "cli/repo",
    retentionDays: ENV_RETENTION_DAYS,
    summaryMode: false,
    unreadOnly: true,
  })
  expect(loaded.githubToken).toBe("dotenv-token")
}

function parsesEnvOverrides(): void {
  const loaded = loadConfigFromSources({
    dotenv: "GITHUB_PAT=dotenv-token\n",
    env: {
      GHT_PARTICIPANTS: "@octocat,@acme/platform",
      GHT_REPO: "env/repo",
      GHT_SHOW_FOOTER: "false",
      GHT_SUMMARY_MODE: "true",
      GHT_TEAM_SYNC_INTERVAL_SECONDS: "120",
      GITHUB_PAT: "process-token",
    },
  })

  expect(loaded.config).toMatchObject({
    participants: [
      { kind: "user", login: "octocat" },
      { kind: "team", org: "acme", slug: "platform" },
    ],
    showFooter: false,
    summaryMode: true,
    teamSyncIntervalSeconds: TEAM_SYNC_INTERVAL_SECONDS,
  })
  expect(loaded.githubToken).toBe("process-token")
}

function ignoresInvalidEnvOverrides(): void {
  const loaded = loadConfigFromSources({
    env: {
      GHT_PARTICIPANTS: "",
      GHT_POLL_INTERVAL_SECONDS: "0",
      GHT_REPO: "env/repo",
      GHT_SUMMARY_MODE: "yes",
    },
  })

  expect(loaded.config).toMatchObject({
    pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
    summaryMode: true,
  })
  expect(loaded.githubToken).toBeUndefined()
}

async function loadsThroughFileAdapter(): Promise<void> {
  const files = new Map<string, string>([
    ["/config.yaml", "repo: file/repo\n"],
    ["/.env", "GHT_REPO=dotenv/repo\nGITHUB_PAT=token-from-dotenv\n"],
  ])

  const loaded = await loadConfig({
    fileAdapter: createMemoryFileAdapter(files),
    paths: createConfigPaths(),
  })

  expect(loaded.config.repo).toBe("dotenv/repo")
  expect(loaded.githubToken).toBe("token-from-dotenv")
  expect(loaded.sources).toStrictEqual({
    configFileLoaded: true,
    dotenvLoaded: true,
  })
}

async function loadsWithoutOptionalFiles(): Promise<void> {
  const loaded = await loadConfig({
    env: {
      GHT_REPO: "env/repo",
    },
    fileAdapter: createMemoryFileAdapter(new Map()),
    paths: {
      configPath: "/missing-config.yaml",
      dotenvPath: "/missing.env",
    },
  })

  expect(loaded.config.repo).toBe("env/repo")
  expect(loaded.sources).toStrictEqual({
    configFileLoaded: false,
    dotenvLoaded: false,
  })
}

async function mergesRuntimeConfig(): Promise<void> {
  const files = createExistingConfigFiles()
  const adapter = createMemoryFileAdapter(files)

  await persistRuntimeConfig({
    fileAdapter: adapter,
    paths: {
      configPath: "/config.yaml",
    },
    runtimeConfig: {
      participants: [{ kind: "team", org: "acme", slug: "platform" }],
      summaryMode: false,
    },
  })

  expect(files.get("/config.yaml")).toBe(createMergedRuntimeConfigYaml())
}

async function persistsRuntimeConfigOnly(): Promise<void> {
  const files = new Map<string, string>([["/config.yaml", "- not\n- an\n- object\n"]])
  const adapter = createMemoryFileAdapter(files)

  await persistRuntimeConfig({
    fileAdapter: adapter,
    paths: {
      configPath: "/config.yaml",
    },
    runtimeConfig: {
      unreadOnly: true,
    },
  })

  expect(files.get("/config.yaml")).toBe("unreadOnly: true\n")
}

function throwsWhenRequiredConfigIsAbsent(): void {
  expect(() => loadConfigFromSources({})).toThrow("Invalid input")
}

function throwsWhenCliConfigIsInvalid(): void {
  expect(() =>
    loadConfigFromSources({
      cli: {
        pollIntervalSeconds: INVALID_POLL_INTERVAL_SECONDS,
        repo: "cli/repo",
      },
    }),
  ).toThrow("Invalid CLI config")
}

function createLayeredSources() {
  return {
    cli: {
      repo: "cli/repo",
      summaryMode: false,
    },
    configFile: [
      "repo: file/repo",
      "pollIntervalSeconds: 10",
      "summaryMode: true",
      "github:",
      "  patEnv: FILE_PAT",
    ].join("\n"),
    dotenv: [
      "GHT_REPO=dotenv/repo",
      "GHT_POLL_INTERVAL_SECONDS=20",
      "DOTENV_PAT=dotenv-token",
    ].join("\n"),
    env: {
      GHT_GITHUB_PAT_ENV: "DOTENV_PAT",
      GHT_REPO: "env/repo",
      GHT_RETENTION_DAYS: "14",
      GHT_UNREAD_ONLY: "true",
    },
  }
}

function createConfigPaths() {
  return {
    configPath: "/config.yaml",
    dotenvPath: "/.env",
  }
}

function createExistingConfigFiles(): Map<string, string> {
  return new Map<string, string>([
    [
      "/config.yaml",
      [
        "repo: acme/widgets",
        "github:",
        "  patEnv: CUSTOM_PAT",
        "retentionDays: 30",
        "unreadOnly: true",
      ].join("\n"),
    ],
  ])
}

function createMergedRuntimeConfigYaml(): string {
  return [
    "repo: acme/widgets",
    "github:",
    "  patEnv: CUSTOM_PAT",
    "retentionDays: 30",
    "unreadOnly: true",
    "participants:",
    "  - kind: team",
    "    org: acme",
    "    slug: platform",
    "summaryMode: false",
    "",
  ].join("\n")
}

function createMemoryFileAdapter(files: Map<string, string>): ConfigFileAdapter {
  return {
    async readTextFile(path) {
      const content = files.get(path)
      await Promise.resolve()

      return content
    },
    async writeTextFile(path, content) {
      files.set(path, content)
      await Promise.resolve()
    },
  }
}
