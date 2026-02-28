#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, renameSync, unlinkSync, readdirSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";

// Log to file for debugging
const LOG_FILE = join(tmpdir(), "opencode-orchestrator.log");
function log(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [postinstall] ${message} ${data ? JSON.stringify(data) : ""}\n`;
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

/**
 * Detect if running inside WSL2 (Windows Subsystem for Linux).
 * In WSL2, opencode typically uses the Windows-side config at %APPDATA%/opencode,
 * which is accessible via /mnt/c/Users/<user>/AppData/Roaming/opencode.
 */
function detectWSLWindowsConfigDir(): string | null {
  try {
    // Check if we're in WSL
    const isWSL = process.env.WSL_DISTRO_NAME || process.env.WSLENV;
    if (!isWSL) {
      try {
        const procVersion = readFileSync("/proc/version", "utf-8");
        if (!/microsoft|WSL/i.test(procVersion)) return null;
      } catch {
        return null;
      }
    }

    // In WSL2, Windows drives are mounted under /mnt/<driveletter>
    // Only /mnt/c is the standard location; avoid duplicates by checking one at a time
    const windowsUser = process.env.WINDOWS_USERNAME || process.env.USERNAME;
    const candidates: string[] = [];

    const userDir = "/mnt/c/Users";
    if (existsSync(userDir)) {
      try {
        const users = readdirSync(userDir);
        for (const user of users) {
          // Skip system/hidden directories
          if (["Public", "Default", "Default User", "All Users", "desktop.ini"]
            .includes(user) || user.startsWith(".")) continue;
          const candidate = join(userDir, user, "AppData", "Roaming", "opencode");
          candidates.push(candidate);
        }
      } catch { /* ignore */ }
    }

    // If WINDOWS_USERNAME / USERNAME is known, prefer that user's directory first
    if (windowsUser) {
      const preferred = `/mnt/c/Users/${windowsUser}/AppData/Roaming/opencode`;
      if (candidates.includes(preferred)) {
        return preferred;
      }
    }

    // Return the first existing opencode config dir, or the first candidate
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }

    return candidates[0] || null;
  } catch {
    return null;
  }
}

/**
 * Get all possible config directories for OpenCode.
 * On Windows, OpenCode may use either:
 * - %APPDATA%/opencode (native Windows)
 * - ~/.config/opencode (Git Bash, WSL, MSYS2)
 */
function getConfigPaths(): string[] {
  const paths: string[] = [];

  // XDG_CONFIG_HOME takes highest priority
  if (process.env.XDG_CONFIG_HOME) {
    paths.push(join(process.env.XDG_CONFIG_HOME, "opencode"));
  }

  // On Windows, check both possible locations
  if (process.platform === "win32") {
    // Native Windows path
    const appDataPath =
      process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    paths.push(join(appDataPath, "opencode"));

    // Git Bash / WSL / MSYS2 style path
    const dotConfigPath = join(homedir(), ".config", "opencode");
    if (!paths.includes(dotConfigPath)) {
      paths.push(dotConfigPath);
    }
  } else {
    // Unix-like systems (including WSL2 Linux side)
    paths.push(join(homedir(), ".config", "opencode"));

    // WSL2: also check the Windows-side config directory
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
 * Register plugin in a single config file with rollback support.
 *
 * SAFE MERGE POLICY:
 * - If the file exists and is valid JSON → only add plugin entry, preserve everything else
 * - If the file exists but JSON is corrupt → DO NOT overwrite; back up and skip
 * - If the file does not exist → create minimal config with plugin entry
 */
function registerInConfig(configDir: string): { success: boolean; backupFile: string | null; skipped?: boolean } {
  const configFile = join(configDir, "opencode.json");
  let backupFile: string | null = null;

  try {
    // Create directory if needed
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true, mode: 0o755 });
      log("Created config directory", { configDir });
    }

    let config: Record<string, any> = {};
    let fileExisted = false;

    // Read existing config
    if (existsSync(configFile)) {
      fileExisted = true;
      const rawContent = readFileSync(configFile, "utf-8").trim();

      if (rawContent) {
        let parseError: unknown;
        try {
          config = JSON.parse(rawContent);
        } catch (err) {
          parseError = err;
        }

        if (parseError) {
          // ⚠️ JSON is corrupted — do NOT overwrite, just skip this path safely
          backupFile = createBackup(configFile);
          log("Corrupted config JSON, skipping this path to avoid data loss", { configFile });
          console.log(`⚠️  opencode.json at ${configFile} has invalid JSON and was skipped.`);
          if (backupFile) {
            console.log(`   Backup saved: ${backupFile}`);
          }
          console.log(`   Please fix the file manually, then add "${PLUGIN_NAME}" to the "plugin" array.`);
          return { success: false, backupFile, skipped: true };
        }

        // Config parsed successfully — validate structure
        if (!validateConfig(config)) {
          // Invalid structure (e.g., plugin is not an array) — preserve file, skip
          log("Unexpected config structure, skipping to avoid corruption", { config, configFile });
          console.log(`⚠️  Unexpected config structure in ${configFile}. Skipping to avoid corruption.`);
          console.log(`   Please manually add "${PLUGIN_NAME}" to the "plugin" array.`);
          return { success: false, backupFile: null, skipped: true };
        }
      }
    }

    // Ensure plugin array exists
    if (!config.plugin) {
      config.plugin = [];
    }

    // Check if already registered (case-insensitive, exact match)
    const hasPlugin = config.plugin.some((p: string) => {
      if (typeof p !== "string") return false;
      return p === PLUGIN_NAME || p.includes(PLUGIN_NAME);
    });

    if (hasPlugin) {
      log("Plugin already registered", { configFile });
      return { success: false, backupFile };
    }

    // Create backup before modifying existing file
    if (fileExisted) {
      backupFile = createBackup(configFile);
    }

    // Add plugin to array
    config.plugin.push(PLUGIN_NAME);
    log("Adding plugin to config", { plugin: PLUGIN_NAME, configFile });

    // Atomic write (temp file + rename)
    atomicWriteJSON(configFile, config);

    // Verify write succeeded
    try {
      const verifyContent = readFileSync(configFile, "utf-8");
      const verifyConfig = JSON.parse(verifyContent);
      if (!verifyConfig.plugin?.includes(PLUGIN_NAME)) {
        throw new Error("Verification failed: plugin not found after write");
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

    log("Plugin registered successfully", { configFile });
    return { success: true, backupFile };
  } catch (error) {
    log("Registration failed", { error: String(error), configFile });

    // Rollback: restore from backup
    if (backupFile && existsSync(backupFile)) {
      try {
        copyFileSync(backupFile, configFile);
        log("Rolled back to backup", { backupFile });
        console.log(`⚠️  Registration failed. Restored from backup: ${backupFile}`);
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
  console.log("🎯 OpenCode Orchestrator - Installing...");
  log("Installation started", { platform: process.platform, node: process.version });

  const configPaths = getConfigPaths();
  log("Config paths to check", configPaths);

  let registered = false;
  let alreadyRegistered = false;
  let skippedCorrupt = false;
  let backupCreated: string | null = null;

  for (const configDir of configPaths) {
    const configFile = join(configDir, "opencode.json");

    // Check if already registered
    if (existsSync(configFile)) {
      try {
        const content = readFileSync(configFile, "utf-8").trim();
        if (content) {
          const config = JSON.parse(content);
          if (config.plugin?.some((p: string) => typeof p === "string" && (p === PLUGIN_NAME || p.includes(PLUGIN_NAME)))) {
            alreadyRegistered = true;
            log("Plugin already registered in this location", { configFile });
            continue;
          }
        }
      } catch (error) {
        log("Error checking existing config", { error: String(error), configFile });
        // Continue to attempt registration with backup/rollback safety
      }
    }

    const result = registerInConfig(configDir);
    if (result.skipped) {
      skippedCorrupt = true;
      if (result.backupFile) backupCreated = result.backupFile;
    } else if (result.success) {
      console.log(`✅ Plugin registered: ${configFile}`);
      if (result.backupFile) {
        console.log(`   Backup created: ${result.backupFile}`);
        backupCreated = result.backupFile;
      }
      registered = true;

      // Cleanup old backups
      cleanupOldBackups(configFile);
    } else if (result.backupFile) {
      backupCreated = result.backupFile;
    }
  }

  if (registered) {
    // Already printed per-file success above
  } else if (alreadyRegistered) {
    console.log("✅ Plugin already registered in all detected config locations.");
    log("Plugin was already registered");
  } else if (skippedCorrupt) {
    // Warnings already printed inside registerInConfig — nothing more to do
    log("Skipped due to corrupted config");
  } else {
    console.log("⚠️  Could not register plugin in any config location.");
    console.log("   This may be due to permissions or file system issues.");
    console.log(`   Check logs: ${LOG_FILE}`);
    log("Failed to register plugin in any location");
  }

  console.log("");
  console.log("🚀 Ready! Restart OpenCode to use.");
  console.log("");
  log("Installation completed", { registered, alreadyRegistered, skippedCorrupt, backupCreated });
} catch (error) {
  log("Installation error", { error: String(error) });
  console.error("❌ " + formatError(error, "register plugin"));
  console.log(`   Check logs: ${LOG_FILE}`);
  process.exit(0); // Don't fail npm install
}
