#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, appendFileSync, copyFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  OPENCODE_SCHEMA_URL,
  PLUGIN_NAME,
  type OpenCodeConfig,
  atomicWriteJSON,
  cleanupOldBackups,
  createBackup,
  formatError,
  getConfigPaths,
  getLegacyConfigPaths,
  invalidateStalePluginCache,
  isOurPluginEntry,
  parseConfigContent,
  readExistingConfig,
  removeOurPluginEntries,
  resolveConfigFile,
  validateConfig,
} from "./opencode-config.ts";

const isCI = process.env.CI === "true" || process.env.CONTINUOUS_INTEGRATION === "true";

const TIMEOUT_MS = 30000;
const timeoutId = setTimeout(() => {
  console.log("⚠️  postinstall timeout - exiting gracefully");
  process.exit(0);
}, TIMEOUT_MS);

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

const LOG_FILE = join(tmpdir(), "opencode-orchestrator.log");
function log(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [postinstall] ${message} ${data ? JSON.stringify(data) : ""}\n`;
    appendFileSync(LOG_FILE, entry);
  } catch { /* ignore */ }
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
  const configFile = resolveConfigFile(configDir);
  let backupFile: string | null = null;
  let originalContent: string | undefined;

  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true, mode: 0o755 });
      log("Created config directory", { configDir });
    }

    let config: OpenCodeConfig = {};
    let fileExisted = false;

    if (existsSync(configFile)) {
      fileExisted = true;
      const rawContent = readFileSync(configFile, "utf-8");
      originalContent = rawContent;
      const trimmedContent = rawContent.trim();

      if (trimmedContent) {
        const parsed = parseConfigContent(trimmedContent);

        if (parsed.parseError) {
          backupFile = createBackup(configFile, log);
          log("Corrupted config JSON, skipping this path to avoid data loss", { configFile, parseError: parsed.parseError });
          console.log(`⚠️  opencode config at ${configFile} has invalid JSON/JSONC and was skipped.`);
          if (backupFile) {
            console.log(`   Backup saved: ${backupFile}`);
          }
          console.log(`   Please fix the file manually, then add "${PLUGIN_NAME}" to the "plugin" array.`);
          return { success: false, backupFile, skipped: true };
        }

        config = parsed.config ?? {};

        if (!validateConfig(config)) {
          log("Unexpected config structure, skipping to avoid corruption", { config, configFile });
          console.log(`⚠️  Unexpected config structure in ${configFile}. Skipping to avoid corruption.`);
          console.log(`   Please manually add "${PLUGIN_NAME}" to the "plugin" array.`);
          return { success: false, backupFile: null, skipped: true };
        }
      }
    }

    if (!config.plugin) {
      config.plugin = [];
      if (!fileExisted && !config["$schema"]) {
        config["$schema"] = OPENCODE_SCHEMA_URL;
      }
    }

    const hasPlugin = config.plugin.some((entry: unknown) => isOurPluginEntry(entry));

    if (hasPlugin) {
      log("Plugin already registered", { configFile });
      return { success: false, backupFile };
    }

    if (fileExisted) {
      backupFile = createBackup(configFile, log);
    }

    config.plugin.push(PLUGIN_NAME);
    log("Adding plugin to config", { plugin: PLUGIN_NAME, configFile });

    atomicWriteJSON(configFile, config, originalContent, log);

    try {
      const verifyContent = readFileSync(configFile, "utf-8");
      const verifyParsed = parseConfigContent(verifyContent);
      if (verifyParsed.parseError || !verifyParsed.config) {
        throw new Error(`Verification parse failed: ${verifyParsed.parseError ?? "unknown parse error"}`);
      }
      const verifyConfig = verifyParsed.config;
      if (!verifyConfig.plugin?.some((entry: unknown) => isOurPluginEntry(entry))) {
        throw new Error("Verification failed: plugin not found after write");
      }
    } catch (verifyError) {
      log("Write verification failed, rolling back", { error: String(verifyError) });
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

try {
  if (isCI) log("Running in CI mode");
  console.log("🎯 OpenCode Orchestrator - Installing...");
  log("Installation started", { platform: process.platform, node: process.version });

  // Drop previously cached builds so OpenCode loads this install, not a stale copy.
  try {
    const stale = invalidateStalePluginCache(undefined, log);
    if (stale.length > 0) {
      console.log(`🧹 Cleared ${stale.length} stale cached cop${stale.length === 1 ? "y" : "ies"}.`);
    }
  } catch (error) {
    log("Stale cache invalidation failed, continuing", { error: String(error) });
  }

  if (isCI) {
    console.log("ℹ️  CI environment detected. Skipping automatic plugin registration.");
    log("Skipping automatic plugin registration in CI");
    clearTimeout(timeoutId);
    process.exit(0);
  }

  const configPaths = getConfigPaths(log);
  log("Config paths to check", configPaths);

  // Older installs registered in dirs OpenCode never reads (win32 %APPDATA%).
  // Move those stale entries to the real config instead of leaving a dead copy.
  for (const legacyDir of getLegacyConfigPaths()) {
    if (configPaths.includes(legacyDir)) continue;
    try {
      const migrated = removeOurPluginEntries(legacyDir, log);
      if (migrated.removed) {
        console.log(`🧹 Migrated stale registration from: ${resolveConfigFile(legacyDir)}`);
        if (migrated.backupFile) {
          console.log(`   Backup created: ${migrated.backupFile}`);
        }
      }
    } catch (error) {
      log("Legacy migration failed, continuing with normal registration", {
        legacyDir,
        error: String(error),
      });
    }
  }

  let registered = false;
  let alreadyRegistered = false;
  let skippedCorrupt = false;
  let backupCreated: string | null = null;
  let targetConfigDir = configPaths[0];

  for (const configDir of configPaths) {
    const existing = readExistingConfig(configDir);
    if (!existing) {
      continue;
    }

    targetConfigDir = configDir;
    if (existing.config.plugin?.some((entry: unknown) => isOurPluginEntry(entry))) {
      alreadyRegistered = true;
      log("Plugin already registered in this location", { configFile: existing.file });
      break;
    }
  }

  if (!alreadyRegistered && targetConfigDir) {
    const configFile = resolveConfigFile(targetConfigDir);
    const result = registerInConfig(targetConfigDir);
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
      cleanupOldBackups(configFile, log);
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
    log("Skipped due to corrupted config");
  } else {
    console.log("⚠️  Could not register plugin in any config location.");
    console.log("   This may be due to permissions or file system issues.");
    console.log(`   Check logs: ${LOG_FILE}`);
    log("Failed to register plugin in any location");
  }

  clearTimeout(timeoutId);

  console.log("");
  console.log("🚀 Ready! Restart OpenCode to use.");
  console.log("");
  log("Installation completed", { registered, alreadyRegistered, skippedCorrupt, backupCreated });
} catch (error) {
  log("Installation error", { error: String(error) });
  console.error("❌ " + formatError(error, "register plugin"));
  console.log(`   Check logs: ${LOG_FILE}`);
  process.exit(0);
} finally {
  clearTimeout(timeoutId);
}
