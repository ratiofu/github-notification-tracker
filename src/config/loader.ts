import { parse as parseDotenv } from "dotenv";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { z } from "zod";

import {
  AppConfigSchema,
  PersistedRuntimeConfigSchema,
  RuntimeSettingsOverrideSchema,
} from "../domain/config.js";
import type {
  ConfigSourceValues,
  LoadConfigInput,
  LoadedConfig,
  PersistRuntimeConfigInput,
} from "./types.js";

/** Startup config sources may override non-runtime fields that runtime persistence cannot write. */
const ConfigOverrideSchema = RuntimeSettingsOverrideSchema.extend({
  github: z
    .object({
      patEnv: z.string().min(1).optional(),
    })
    .optional(),
  repo: z.string().optional(),
  retentionDays: z.number().int().positive().optional(),
});

type ConfigOverride = z.infer<typeof ConfigOverrideSchema>;

export async function loadConfig(input: LoadConfigInput): Promise<LoadedConfig> {
  const dotenv = await input.fileAdapter.readTextFile(input.paths.dotenvPath);
  const configFile = await input.fileAdapter.readTextFile(input.paths.configPath);
  const sourceValues: ConfigSourceValues = {
    ...(input.cli === undefined ? {} : { cli: input.cli }),
    ...(configFile === undefined ? {} : { configFile }),
    ...(dotenv === undefined ? {} : { dotenv }),
    ...(input.env === undefined ? {} : { env: input.env }),
  };

  return loadConfigFromSources(sourceValues);
}

export function loadConfigFromSources(sources: ConfigSourceValues): LoadedConfig {
  const dotenvEnv = parseDotenvConfig(sources.dotenv);
  const processEnv = sources.env ?? {};

  const fileConfig = parseConfigOverride(sources.configFile, "config file");
  const dotenvConfig = parseEnvConfig(dotenvEnv);
  const envConfig = parseEnvConfig(processEnv);
  const cliConfig = parseConfigOverride(sources.cli, "CLI config");

  const config = AppConfigSchema.parse(
    mergeConfigOverrides(fileConfig, dotenvConfig, envConfig, cliConfig),
  );

  const loadedConfig: LoadedConfig = {
    config,
    sources: {
      configFileLoaded: sources.configFile !== undefined,
      dotenvLoaded: sources.dotenv !== undefined,
    },
  };

  const githubToken = resolveGithubToken(config.github.patEnv, processEnv, dotenvEnv);
  if (githubToken !== undefined) {
    return {
      ...loadedConfig,
      githubToken,
    };
  }

  return loadedConfig;
}

/** Merges runtime settings into existing YAML so required startup config survives writes. */
export async function persistRuntimeConfig(input: PersistRuntimeConfigInput): Promise<void> {
  const runtimeConfig = PersistedRuntimeConfigSchema.parse(input.runtimeConfig);
  const existingConfig = parseConfigDocument(
    await input.fileAdapter.readTextFile(input.paths.configPath),
  );
  const serialized = stringifyYaml({
    ...existingConfig,
    ...runtimeConfig,
  });

  await input.fileAdapter.writeTextFile(input.paths.configPath, serialized);
}

function parseDotenvConfig(dotenvContent: string | undefined): NodeJS.ProcessEnv {
  if (dotenvContent === undefined) {
    return {};
  }

  return parseDotenv(dotenvContent);
}

function parseConfigOverride(value: unknown, sourceName: string): ConfigOverride {
  if (value === undefined) {
    return {};
  }

  if (typeof value === "string") {
    const parsed = parseYaml(value);

    return ConfigOverrideSchema.parse(parsed ?? {});
  }

  const parsed = ConfigOverrideSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid ${sourceName}: ${parsed.error.message}`);
  }

  return parsed.data;
}

/** Parses existing YAML before runtime persistence so non-runtime config survives writes. */
function parseConfigDocument(value: string | undefined): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }

  const parsed = parseYaml(value);

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return parsed as Record<string, unknown>;
}

function parseEnvConfig(env: NodeJS.ProcessEnv): ConfigOverride {
  return ConfigOverrideSchema.parse({
    github: {
      patEnv: env.GHT_GITHUB_PAT_ENV,
    },
    participants: parseParticipantSelections(env.GHT_PARTICIPANTS),
    pollIntervalSeconds: parsePositiveInteger(env.GHT_POLL_INTERVAL_SECONDS),
    repo: env.GHT_REPO,
    retentionDays: parsePositiveInteger(env.GHT_RETENTION_DAYS),
    showFooter: parseBoolean(env.GHT_SHOW_FOOTER),
    summaryMode: parseBoolean(env.GHT_SUMMARY_MODE),
    teamSyncIntervalSeconds: parsePositiveInteger(env.GHT_TEAM_SYNC_INTERVAL_SECONDS),
    unreadOnly: parseBoolean(env.GHT_UNREAD_ONLY),
  });
}

function mergeConfigOverrides(...configs: readonly ConfigOverride[]): ConfigOverride {
  let merged: ConfigOverride = {};

  for (const config of configs) {
    const next = withoutUndefined(config);
    delete next.github;
    Object.assign(merged, next);

    if (config.github !== undefined) {
      merged.github = Object.assign({}, merged.github, withoutUndefined(config.github));
    }
  }

  return merged;
}

function resolveGithubToken(
  patEnv: string,
  processEnv: NodeJS.ProcessEnv,
  dotenvEnv: NodeJS.ProcessEnv,
): string | undefined {
  return processEnv[patEnv] ?? dotenvEnv[patEnv];
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

function parseParticipantSelections(value: string | undefined): unknown {
  if (value === undefined || value === "") {
    return undefined;
  }

  return value.split(",").map((selection) => {
    const trimmed = selection.trim();
    const teamMatch = /^@?([^/]+)\/([^/]+)$/.exec(trimmed);

    if (teamMatch !== null) {
      return {
        kind: "team",
        org: teamMatch[1],
        slug: teamMatch[2],
      };
    }

    return {
      kind: "user",
      login: trimmed.replace(/^@/, ""),
    };
  });
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as Partial<T>;
}
