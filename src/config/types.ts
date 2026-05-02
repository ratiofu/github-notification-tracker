import type { AppConfig, PersistedRuntimeConfig } from "../domain/config.js";

export interface ConfigPaths {
  readonly configPath: string;
  readonly dotenvPath: string;
}

/** Keeps config merging pure by isolating filesystem reads and writes. */
export interface ConfigFileAdapter {
  readonly readTextFile: (path: string) => Promise<string | undefined>;
  readonly writeTextFile: (path: string, content: string) => Promise<void>;
}

export interface ConfigSourceValues {
  readonly cli?: unknown;
  readonly env?: NodeJS.ProcessEnv;
  readonly dotenv?: string;
  readonly configFile?: string;
}

export interface LoadedConfig {
  readonly config: AppConfig;
  readonly githubToken?: string;
  readonly sources: LoadedConfigSources;
}

export interface LoadedConfigSources {
  readonly configFileLoaded: boolean;
  readonly dotenvLoaded: boolean;
}

export interface LoadConfigInput {
  readonly cli?: unknown;
  readonly env?: NodeJS.ProcessEnv;
  readonly fileAdapter: ConfigFileAdapter;
  readonly paths: ConfigPaths;
}

export interface PersistRuntimeConfigInput {
  readonly fileAdapter: ConfigFileAdapter;
  readonly paths: Pick<ConfigPaths, "configPath">;
  readonly runtimeConfig: PersistedRuntimeConfig;
}
