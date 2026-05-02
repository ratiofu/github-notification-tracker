import { describe, expect, it } from "vitest";

import { loadConfig, loadConfigFromSources, persistRuntimeConfig } from "./loader.js";
import type { ConfigFileAdapter } from "./types.js";

describe("config loading", () => {
  it("merges config file, .env, env, and CLI by precedence", () => {
    const loaded = loadConfigFromSources({
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
    });

    expect(loaded.config).toMatchObject({
      github: { patEnv: "DOTENV_PAT" },
      pollIntervalSeconds: 20,
      repo: "cli/repo",
      retentionDays: 14,
      summaryMode: false,
      unreadOnly: true,
    });
    expect(loaded.githubToken).toBe("dotenv-token");
  });

  it("parses env participants, booleans, and process token precedence", () => {
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
    });

    expect(loaded.config).toMatchObject({
      participants: [
        { kind: "user", login: "octocat" },
        { kind: "team", org: "acme", slug: "platform" },
      ],
      showFooter: false,
      summaryMode: true,
      teamSyncIntervalSeconds: 120,
    });
    expect(loaded.githubToken).toBe("process-token");
  });

  it("ignores blank or invalid env override values", () => {
    const loaded = loadConfigFromSources({
      env: {
        GHT_PARTICIPANTS: "",
        GHT_POLL_INTERVAL_SECONDS: "0",
        GHT_REPO: "env/repo",
        GHT_SUMMARY_MODE: "yes",
      },
    });

    expect(loaded.config.pollIntervalSeconds).toBe(30);
    expect(loaded.config.summaryMode).toBe(true);
    expect(loaded.githubToken).toBeUndefined();
  });

  it("loads YAML and .env through the file adapter", async () => {
    const files = new Map<string, string>([
      ["/config.yaml", "repo: file/repo\n"],
      ["/.env", "GHT_REPO=dotenv/repo\nGITHUB_PAT=token-from-dotenv\n"],
    ]);

    const loaded = await loadConfig({
      fileAdapter: createMemoryFileAdapter(files),
      paths: {
        configPath: "/config.yaml",
        dotenvPath: "/.env",
      },
    });

    expect(loaded.config.repo).toBe("dotenv/repo");
    expect(loaded.githubToken).toBe("token-from-dotenv");
    expect(loaded.sources).toEqual({
      configFileLoaded: true,
      dotenvLoaded: true,
    });
  });

  it("loads when optional config files are absent", async () => {
    const loaded = await loadConfig({
      env: {
        GHT_REPO: "env/repo",
      },
      fileAdapter: createMemoryFileAdapter(new Map()),
      paths: {
        configPath: "/missing-config.yaml",
        dotenvPath: "/missing.env",
      },
    });

    expect(loaded.config.repo).toBe("env/repo");
    expect(loaded.sources).toEqual({
      configFileLoaded: false,
      dotenvLoaded: false,
    });
  });

  it("merges runtime config into existing YAML without materializing absent defaults", async () => {
    const files = new Map<string, string>([
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
    ]);
    const adapter = createMemoryFileAdapter(files);

    await persistRuntimeConfig({
      fileAdapter: adapter,
      paths: {
        configPath: "/config.yaml",
      },
      runtimeConfig: {
        participants: [{ kind: "team", org: "acme", slug: "platform" }],
        summaryMode: false,
      },
    });

    expect(files.get("/config.yaml")).toBe(
      [
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
      ].join("\n"),
    );
  });

  it("persists runtime config when the existing YAML is absent or non-object", async () => {
    const files = new Map<string, string>([["/config.yaml", "- not\n- an\n- object\n"]]);
    const adapter = createMemoryFileAdapter(files);

    await persistRuntimeConfig({
      fileAdapter: adapter,
      paths: {
        configPath: "/config.yaml",
      },
      runtimeConfig: {
        unreadOnly: true,
      },
    });

    expect(files.get("/config.yaml")).toBe("unreadOnly: true\n");
  });

  it("throws when required config is absent", () => {
    expect(() => loadConfigFromSources({})).toThrow();
  });

  it("throws when CLI config is invalid", () => {
    expect(() =>
      loadConfigFromSources({
        cli: {
          pollIntervalSeconds: -1,
          repo: "cli/repo",
        },
      }),
    ).toThrow("Invalid CLI config");
  });
});

function createMemoryFileAdapter(files: Map<string, string>): ConfigFileAdapter {
  return {
    async readTextFile(path) {
      return files.get(path);
    },
    async writeTextFile(path, content) {
      files.set(path, content);
    },
  };
}
