import { existsSync, readFileSync, writeFileSync, copyFileSync, renameSync, unlinkSync, readdirSync } from "fs";
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

export function getConfigPaths(log?: ConfigLogger): string[] {
  const paths: string[] = [];

  if (process.env.XDG_CONFIG_HOME) {
    paths.push(join(process.env.XDG_CONFIG_HOME, "opencode"));
  }

  if (process.platform === "win32") {
    const appDataPath =
      process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    paths.push(join(appDataPath, "opencode"));

    const dotConfigPath = join(homedir(), ".config", "opencode");
    if (!paths.includes(dotConfigPath)) {
      paths.push(dotConfigPath);
    }
  } else {
    paths.push(join(homedir(), ".config", "opencode"));

    const wslWindowsConfig = detectWSLWindowsConfigDir();
    if (wslWindowsConfig && !paths.includes(wslWindowsConfig)) {
      log?.("Detected WSL2 - also checking Windows config path", { wslWindowsConfig });
      paths.push(wslWindowsConfig);
    }
  }

  return [...new Set(paths)];
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
