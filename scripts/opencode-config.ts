import { existsSync, readFileSync, writeFileSync, copyFileSync, renameSync, unlinkSync, readdirSync, rmSync } from "fs";
import { homedir } from "os";
import { dirname, join, basename } from "path";
import { applyEdits, modify, parse as parseJsonc, printParseErrorCode, type ParseError } from "jsonc-parser";

export const PLUGIN_NAME = "opencode-orchestrator";
export const OPENCODE_SCHEMA_URL = "https://opencode.ai/config.json";

export type PluginOptions = Record<string, unknown>;
export type PluginTuple = [string, PluginOptions];
export type PluginEntry = string | PluginTuple;
export type OpenCodeConfig = Record<string, unknown> & {
  plugin?: PluginEntry[];
  "$schema"?: string;
};

export type ConfigLogger = (message: string, data?: unknown) => void;

interface NodeError extends Error {
  code?: string;
}

export function formatError(err: unknown, context: string): string {
  if (err instanceof Error) {
    const nodeErr = err as NodeError;
    if (nodeErr.code === "EACCES" || nodeErr.code === "EPERM") {
      return `Permission denied: Cannot ${context}. Try running as administrator.`;
    }
    if (nodeErr.code === "ENOENT") {
      return `File not found while trying to ${context}.`;
    }
    if (err instanceof SyntaxError) {
      return `JSON syntax error while trying to ${context}: ${err.message}.`;
    }
    if (nodeErr.code === "EIO") {
      return `File lock error: Cannot ${context}. Please close OpenCode and try again.`;
    }
    if (nodeErr.code === "ENOSPC") {
      return `Disk full: Cannot ${context}. Free up disk space and try again.`;
    }
    if (nodeErr.code === "EROFS") {
      return `Read-only filesystem: Cannot ${context}.`;
    }
    return `Failed to ${context}: ${err.message}`;
  }
  return `Failed to ${context}: ${String(err)}`;
}

function isRecord(value: unknown): value is PluginOptions {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPluginTuple(value: unknown): value is PluginTuple {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === "string"
    && isRecord(value[1]);
}

function isPluginEntry(value: unknown): value is PluginEntry {
  return typeof value === "string" || isPluginTuple(value);
}

function getPluginName(entry: PluginEntry): string {
  return typeof entry === "string" ? entry : entry[0];
}

export function isOurPluginEntry(entry: unknown): boolean {
  if (!isPluginEntry(entry)) return false;
  const pluginName = getPluginName(entry);
  return pluginName === PLUGIN_NAME || pluginName.startsWith(`${PLUGIN_NAME}@`);
}

export function getConfigFileCandidates(configDir: string): string[] {
  return [join(configDir, "opencode.jsonc"), join(configDir, "opencode.json")];
}

export function resolveConfigFile(configDir: string): string {
  for (const candidate of getConfigFileCandidates(configDir)) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return getConfigFileCandidates(configDir)[0];
}

export function parseConfigContent(rawContent: string): { config?: OpenCodeConfig; parseError?: string } {
  const errors: ParseError[] = [];
  const config = parseJsonc(rawContent, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (errors.length > 0) {
    const [firstError] = errors;
    const line = rawContent.slice(0, firstError.offset).split("\n").length;
    const column = firstError.offset - rawContent.lastIndexOf("\n", firstError.offset - 1);
    return {
      parseError: `${printParseErrorCode(firstError.error)} at line ${line}, column ${column}`,
    };
  }

  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return {
      parseError: "Root config must be a JSON object",
    };
  }

  return { config: config as OpenCodeConfig };
}

function detectWSLWindowsConfigDir(): string | null {
  try {
    const isWSL = process.env.WSL_DISTRO_NAME || process.env.WSLENV;
    if (!isWSL) {
      try {
        const procVersion = readFileSync("/proc/version", "utf-8");
        if (!/microsoft|WSL/i.test(procVersion)) return null;
      } catch {
        return null;
      }
    }

    const windowsUser = process.env.WINDOWS_USERNAME || process.env.USERNAME;
    const candidates: string[] = [];

    const userDir = "/mnt/c/Users";
    if (existsSync(userDir)) {
      try {
        const users = readdirSync(userDir);
        for (const user of users) {
          if (["Public", "Default", "Default User", "All Users", "desktop.ini"]
            .includes(user) || user.startsWith(".")) continue;
          const candidate = join(userDir, user, "AppData", "Roaming", "opencode");
          candidates.push(candidate);
        }
      } catch { /* ignore */ }
    }

    if (windowsUser) {
      const preferred = `/mnt/c/Users/${windowsUser}/AppData/Roaming/opencode`;
      if (candidates.includes(preferred)) {
        return preferred;
      }
    }

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }

    return candidates[0] || null;
  } catch {
    return null;
  }
}

export function getConfigPaths(log?: ConfigLogger, platform: NodeJS.Platform = process.platform): string[] {
  const paths: string[] = [];

  // Same precedence as OpenCode itself (Global.Path.config honors this env).
  const customConfigDir = process.env.OPENCODE_CONFIG_DIR?.trim();
  if (customConfigDir) {
    paths.push(customConfigDir);
  }

  if (process.env.XDG_CONFIG_HOME) {
    paths.push(join(process.env.XDG_CONFIG_HOME, "opencode"));
  }

  // OpenCode resolves its global config from xdg-basedir on every platform
  // (Global.Path.config), including win32. Registering anywhere else (for
  // example %APPDATA%) writes a file OpenCode never reads.
  paths.push(join(homedir(), ".config", "opencode"));

  if (platform !== "win32") {
    const wslWindowsConfig = detectWSLWindowsConfigDir();
    if (wslWindowsConfig && !paths.includes(wslWindowsConfig)) {
      log?.("Detected WSL2 - also checking Windows config path", { wslWindowsConfig });
      paths.push(wslWindowsConfig);
    }
  }

  return [...new Set(paths)];
}

/**
 * Config dirs OpenCode itself never reads but older installs may have
 * written to. Used only for migration/cleanup, never for registration.
 */
export function getLegacyConfigPaths(platform: NodeJS.Platform = process.platform): string[] {
  if (platform !== "win32") return [];
  const appDataPath =
    process.env.APPDATA || join(homedir(), "AppData", "Roaming");
  return [join(appDataPath, "opencode")];
}

/**
 * OpenCode's own plugin cache dir (Npm.add installs `<pkg>@<version>` below
 * `<cache>/opencode[/packages]`). A reinstall must drop our stale copies so
 * OpenCode does not keep loading the previous build.
 */
export function getCacheDir(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(base, "opencode");
}

/**
 * Delete stale cached copies of this plugin. Best-effort: never throws, so a
 * locked or unreadable cache can never fail an install. Returns removed dirs.
 */
export function invalidateStalePluginCache(
  options?: { cacheDir?: string },
  log?: ConfigLogger,
): string[] {
  const removed: string[] = [];
  const cacheDir = options?.cacheDir ?? getCacheDir();
  const parentDirs = [cacheDir, join(cacheDir, "packages")];
  const prefix = `${PLUGIN_NAME}@`;

  for (const parentDir of parentDirs) {
    let entries;
    try {
      entries = readdirSync(parentDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
      const target = join(parentDir, entry.name);
      try {
        rmSync(target, { recursive: true, force: true });
        removed.push(target);
        log?.("Removed stale cached plugin copy", { target });
      } catch (error) {
        log?.("Could not remove stale cached plugin copy", { target, error: String(error) });
      }
    }
  }

  return removed;
}

/**
 * Remove our plugin entries from a single legacy config dir.
 *
 * Never throws and never destroys data: corrupt configs are backed up and
 * left untouched, successful removals are verified before returning.
 */
export function removeOurPluginEntries(
  configDir: string,
  log: ConfigLogger,
): { removed: boolean; backupFile: string | null } {
  const configFile = resolveConfigFile(configDir);
  if (!existsSync(configFile)) {
    return { removed: false, backupFile: null };
  }

  let originalContent: string;
  try {
    originalContent = readFileSync(configFile, "utf-8");
  } catch (error) {
    log("Legacy config unreadable, skipping", { configFile, error: String(error) });
    return { removed: false, backupFile: null };
  }

  if (!originalContent.trim()) {
    return { removed: false, backupFile: null };
  }

  const parsed = parseConfigContent(originalContent);
  if (parsed.parseError || !parsed.config) {
    const backupFile = createBackup(configFile, log);
    log("Legacy config corrupt, backed up and left untouched", {
      configFile,
      parseError: parsed.parseError,
      backupFile,
    });
    return { removed: false, backupFile };
  }

  const config = parsed.config;
  if (!validateConfig(config) || !config.plugin?.some((entry: unknown) => isOurPluginEntry(entry))) {
    return { removed: false, backupFile: null };
  }

  const backupFile = createBackup(configFile, log);
  config.plugin = config.plugin.filter((entry: unknown) => !isOurPluginEntry(entry));
  try {
    atomicWriteJSON(configFile, config, originalContent, log);
    const verifyContent = readFileSync(configFile, "utf-8");
    const verifyParsed = parseConfigContent(verifyContent);
    if (verifyParsed.parseError || !verifyParsed.config) {
      throw new Error(`Verification parse failed: ${verifyParsed.parseError ?? "unknown parse error"}`);
    }
    if (verifyParsed.config.plugin?.some((entry: unknown) => isOurPluginEntry(entry))) {
      throw new Error("Verification failed: plugin still present after removal");
    }
  } catch (error) {
    log("Legacy migration write failed, rolling back", { error: String(error), configFile });
    if (backupFile && existsSync(backupFile)) {
      try {
        copyFileSync(backupFile, configFile);
      } catch { /* ignore */ }
    }
    return { removed: false, backupFile };
  }

  cleanupOldBackups(configFile, log);
  return { removed: true, backupFile };
}

export function readExistingConfig(configDir: string): { file: string; config: OpenCodeConfig } | null {
  for (const configFile of getConfigFileCandidates(configDir)) {
    if (!existsSync(configFile)) continue;
    const rawContent = readFileSync(configFile, "utf-8").trim();
    if (!rawContent) {
      return { file: configFile, config: {} };
    }
    const parsed = parseConfigContent(rawContent);
    if (parsed.config) {
      return { file: configFile, config: parsed.config };
    }
  }
  return null;
}

export function validateConfig(config: unknown): config is OpenCodeConfig {
  try {
    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      return false;
    }

    const candidate = config as Record<string, unknown>;
    if (candidate.plugin !== undefined && !Array.isArray(candidate.plugin)) {
      return false;
    }

    if (candidate.plugin) {
      for (const entry of candidate.plugin) {
        if (!isPluginEntry(entry)) {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function createBackup(configFile: string, log: ConfigLogger): string | null {
  try {
    if (!existsSync(configFile)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = `${configFile}.backup.${timestamp}`;
    copyFileSync(configFile, backupFile);
    log("Backup created", { backupFile });
    return backupFile;
  } catch (error) {
    log("Failed to create backup", { error: String(error) });
    return null;
  }
}

export function atomicWriteJSON(
  filePath: string,
  data: OpenCodeConfig,
  originalContent: string | undefined,
  log: ConfigLogger
): void {
  const tempFile = `${filePath}.tmp.${Date.now()}`;
  try {
    let output = JSON.stringify(data, null, 2) + "\n";
    if (filePath.endsWith(".jsonc") && originalContent !== undefined) {
      const source = originalContent.trim() ? originalContent : "{}";
      const edits = modify(source, ["plugin"], data.plugin, {
        formattingOptions: { tabSize: 2, insertSpaces: true },
      });
      output = applyEdits(source, edits);
      if (!output.endsWith("\n")) output += "\n";
    }

    writeFileSync(tempFile, output, { mode: 0o644 });
    renameSync(tempFile, filePath);
    log("Atomic write successful", { filePath });
  } catch (error) {
    try {
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    } catch { /* ignore */ }
    throw error;
  }
}

export function cleanupOldBackups(configFile: string, log: ConfigLogger): void {
  try {
    const configDir = dirname(configFile);
    const configBase = basename(configFile);
    const files = readdirSync(configDir);
    const backupFiles = files
      .filter((fileName: string) => fileName.startsWith(`${configBase}.backup.`))
      .sort()
      .reverse();

    for (let index = 5; index < backupFiles.length; index++) {
      const backupPath = join(configDir, backupFiles[index]);
      try {
        unlinkSync(backupPath);
        log("Deleted old backup", { file: backupFiles[index] });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}
