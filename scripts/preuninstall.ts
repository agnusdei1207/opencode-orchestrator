#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, renameSync, unlinkSync, readdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";

const isCI = process.env.CI === "true" || process.env.CONTINUOUS_INTEGRATION === "true";

const TIMEOUT_MS = 30000;
const timeoutId = setTimeout(() => {
  console.log("⚠️  preuninstall timeout - exiting gracefully");
  process.exit(0);
}, TIMEOUT_MS);

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

// Log to file for debugging
const LOG_FILE = join(tmpdir(), "opencode-orchestrator.log");
function log(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [preuninstall] ${message} ${data ? JSON.stringify(data) : ""}\n`;
    appendFileSync(LOG_FILE, entry);
  } catch { /* ignore */ }
}

interface NodeError extends Error {
  code?: string;
}

function formatError(err: unknown, context: string): string {
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

const PLUGIN_NAME = "opencode-orchestrator";

function isOurPluginEntry(p: string): boolean {
  return p === PLUGIN_NAME || p.startsWith(`${PLUGIN_NAME}@`);
}

/**
 * Get all possible config directories for OpenCode.
 * On Windows, OpenCode may use either:
 * - %APPDATA%/opencode (native Windows)
 * - ~/.config/opencode (Git Bash, WSL, MSYS2)
 */
/**
 * Detect if running inside WSL2 and return the Windows-side OpenCode config path.
 * Mirrors the same logic in postinstall.ts — must stay in sync.
 */
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
      if (candidates.includes(preferred)) return preferred;
    }

    for (const c of candidates) {
      if (existsSync(c)) return c;
    }

    return candidates[0] || null;
  } catch {
    return null;
  }
}

function getConfigPaths(): string[] {
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

    // WSL2: also remove from the Windows-side config directory
    const wslWindowsConfig = detectWSLWindowsConfigDir();
    if (wslWindowsConfig && !paths.includes(wslWindowsConfig)) {
      log("Detected WSL2 - also checking Windows config path", { wslWindowsConfig });
      paths.push(wslWindowsConfig);
    }
  }

  return paths;
}

/**
 * Validate JSON config structure
 */
function validateConfig(config: any): boolean {
  try {
    // Must be an object
    if (typeof config !== "object" || config === null) {
      return false;
    }

    // If plugin field exists, must be an array
    if (config.plugin !== undefined && !Array.isArray(config.plugin)) {
      return false;
    }

    // All plugin entries must be strings
    if (config.plugin) {
      for (const p of config.plugin) {
        if (typeof p !== "string") {
          return false;
        }
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create backup of existing config file
 */
function createBackup(configFile: string): string | null {
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

/**
 * Atomic file write: write to temp file, then rename
 */
function atomicWriteJSON(filePath: string, data: any): void {
  const tempFile = `${filePath}.tmp.${Date.now()}`;
  try {
    // Write to temp file
    writeFileSync(tempFile, JSON.stringify(data, null, 2) + "\n", { mode: 0o644 });

    // Atomic rename (OS-level atomic operation)
    renameSync(tempFile, filePath);
    log("Atomic write successful", { filePath });
  } catch (error) {
    // Cleanup temp file on failure
    try {
      if (existsSync(tempFile)) {
        unlinkSync(tempFile);
      }
    } catch { /* ignore */ }
    throw error;
  }
}

/**
 * Remove plugin from a single config file with rollback support
 */
function removeFromConfig(configDir: string): { success: boolean; backupFile: string | null } {
  const configFile = join(configDir, "opencode.json");
  let backupFile: string | null = null;

  try {
    if (!existsSync(configFile)) {
      log("Config file does not exist", { configFile });
      return { success: false, backupFile: null };
    }

    // Create backup before any modifications
    backupFile = createBackup(configFile);

    // Read existing config
    const content = readFileSync(configFile, "utf-8").trim();
    if (!content) {
      log("Empty config file", { configFile });
      return { success: false, backupFile };
    }

    let config: Record<string, any>;
    try {
      config = JSON.parse(content);
    } catch (error) {
      log("Failed to parse config, skipping", { error: String(error), configFile });
      console.log(`⚠️  Corrupted config detected. Backup saved: ${backupFile}`);
      return { success: false, backupFile };
    }

    // Validate config structure
    if (!validateConfig(config)) {
      log("Invalid config structure, skipping", { config, configFile });
      return { success: false, backupFile };
    }

    if (!config.plugin || !Array.isArray(config.plugin)) {
      log("No plugin array found", { configFile });
      return { success: false, backupFile };
    }

    const originalLength = config.plugin.length;
    const originalPlugins = [...config.plugin];

    config.plugin = config.plugin.filter((p: string) => {
      if (typeof p !== "string") return true;
      return !isOurPluginEntry(p);
    });

    if (config.plugin.length === originalLength) {
      log("Plugin not found in config", { configFile });
      return { success: false, backupFile };
    }

    const removedCount = originalLength - config.plugin.length;
    log("Removing plugin from config", {
      plugin: PLUGIN_NAME,
      removedCount,
      originalPlugins,
      newPlugins: config.plugin,
      configFile
    });

    // Atomic write (temp file + rename)
    atomicWriteJSON(configFile, config);

    // Verify write succeeded
    try {
      const verifyContent = readFileSync(configFile, "utf-8");
      const verifyConfig = JSON.parse(verifyContent);

      const stillHasPlugin = verifyConfig.plugin?.some((p: string) =>
        typeof p === "string" && isOurPluginEntry(p)
      );

      if (stillHasPlugin) {
        throw new Error("Verification failed: plugin still present after removal");
      }
    } catch (verifyError) {
      log("Write verification failed, rolling back", { error: String(verifyError) });
      // Rollback: restore from backup
      if (backupFile && existsSync(backupFile)) {
        copyFileSync(backupFile, configFile);
        console.log(`⚠️  Write verification failed. Restored from backup.`);
      }
      throw verifyError;
    }

    log("Plugin removed successfully", { configFile, removedCount });
    return { success: true, backupFile };
  } catch (error) {
    log("Removal failed", { error: String(error), configFile });

    // Rollback: restore from backup
    if (backupFile && existsSync(backupFile)) {
      try {
        copyFileSync(backupFile, configFile);
        log("Rolled back to backup", { backupFile });
        console.log(`⚠️  Removal failed. Restored from backup: ${backupFile}`);
      } catch (rollbackError) {
        log("Rollback failed", { error: String(rollbackError) });
      }
    }

    return { success: false, backupFile };
  }
}

/**
 * Clean up old backup files (keep only last 5)
 */
function cleanupOldBackups(configFile: string): void {
  try {
    const configDir = join(configFile, "..");
    const files = readdirSync(configDir);
    const backupFiles = files
      .filter((f: string) => f.startsWith("opencode.json.backup."))
      .sort()
      .reverse();

    // Keep only last 5 backups
    for (let i = 5; i < backupFiles.length; i++) {
      const backupPath = join(configDir, backupFiles[i]);
      try {
        unlinkSync(backupPath);
        log("Deleted old backup", { file: backupFiles[i] });
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

try {
  console.log("🧹 OpenCode Orchestrator - Uninstalling...");
  if (isCI) log("Running in CI mode");
  log("Uninstallation started", { platform: process.platform, node: process.version });

  const configPaths = getConfigPaths();
  log("Config paths to check", configPaths);

  let removed = false;
  let backupCreated: string | null = null;

  for (const configDir of configPaths) {
    const configFile = join(configDir, "opencode.json");

    const result = removeFromConfig(configDir);
    if (result.success) {
      console.log(`✅ Plugin removed: ${configFile}`);
      if (result.backupFile) {
        console.log(`   Backup created: ${result.backupFile}`);
        backupCreated = result.backupFile;
      }
      removed = true;

      // Cleanup old backups
      cleanupOldBackups(configFile);
    } else if (result.backupFile) {
      backupCreated = result.backupFile;
    }
  }

  if (!removed) {
    console.log("✅ Plugin was not registered. Nothing to clean up.");
    log("Plugin was not registered");
  }

  console.log("");
  log("Uninstallation completed", { removed, backupCreated });
} catch (error) {
  log("Uninstallation error", { error: String(error) });
  console.error("❌ " + formatError(error, "clean up config"));
  console.log(`   Check logs: ${LOG_FILE}`);
  process.exit(0); // Don't fail npm uninstall
} finally {
  clearTimeout(timeoutId);
}
