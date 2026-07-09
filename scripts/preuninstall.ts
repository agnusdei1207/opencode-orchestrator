#!/usr/bin/env node

import { existsSync, readFileSync, appendFileSync, copyFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  PLUGIN_NAME,
  type OpenCodeConfig,
  atomicWriteJSON,
  cleanupOldBackups,
  createBackup,
  formatError,
  getConfigPaths,
  isOurPluginEntry,
  parseConfigContent,
  resolveConfigFile,
  validateConfig,
} from "./opencode-config.ts";

const isCI = process.env.CI === "true" || process.env.CONTINUOUS_INTEGRATION === "true";

const TIMEOUT_MS = 30000;
const timeoutId = setTimeout(() => {
  console.log("⚠️  preuninstall timeout - exiting gracefully");
  process.exit(0);
}, TIMEOUT_MS);

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

const LOG_FILE = join(tmpdir(), "opencode-orchestrator.log");
function log(message: string, data?: unknown): void {
  try {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [preuninstall] ${message} ${data ? JSON.stringify(data) : ""}\n`;
    appendFileSync(LOG_FILE, entry);
  } catch { /* ignore */ }
}

/**
 * Remove plugin from a single config file with rollback support
 */
function removeFromConfig(configDir: string): { success: boolean; backupFile: string | null } {
  const configFile = resolveConfigFile(configDir);
  let backupFile: string | null = null;
  let originalContent: string | undefined;

  try {
    if (!existsSync(configFile)) {
      log("Config file does not exist", { configFile });
      return { success: false, backupFile: null };
    }

    const content = readFileSync(configFile, "utf-8");
    originalContent = content;
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      log("Empty config file", { configFile });
      return { success: false, backupFile };
    }

    const parsed = parseConfigContent(trimmedContent);
    if (parsed.parseError) {
      backupFile = createBackup(configFile, log);
      log("Failed to parse config, skipping", { error: parsed.parseError, configFile, backupFile });
      console.log(`⚠️  Corrupted config detected. Skipping cleanup for ${configFile}.`);
      if (backupFile) {
        console.log(`   Backup saved: ${backupFile}`);
      }
      return { success: false, backupFile };
    }
    const config: OpenCodeConfig = parsed.config ?? {};

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

    config.plugin = config.plugin.filter((entry: unknown) => !isOurPluginEntry(entry));

    if (config.plugin.length === originalLength) {
      log("Plugin not found in config", { configFile });
      return { success: false, backupFile };
    }

    backupFile = createBackup(configFile, log);

    const removedCount = originalLength - config.plugin.length;
    log("Removing plugin from config", {
      plugin: PLUGIN_NAME,
      removedCount,
      originalPlugins,
      newPlugins: config.plugin,
      configFile
    });

    atomicWriteJSON(configFile, config, originalContent, log);

    try {
      const verifyContent = readFileSync(configFile, "utf-8");
      const verifyParsed = parseConfigContent(verifyContent);
      if (verifyParsed.parseError || !verifyParsed.config) {
        throw new Error(`Verification parse failed: ${verifyParsed.parseError ?? "unknown parse error"}`);
      }
      const verifyConfig = verifyParsed.config;

      const stillHasPlugin = verifyConfig.plugin?.some((entry: unknown) => isOurPluginEntry(entry));

      if (stillHasPlugin) {
        throw new Error("Verification failed: plugin still present after removal");
      }
    } catch (verifyError) {
      log("Write verification failed, rolling back", { error: String(verifyError) });
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

try {
  console.log("🧹 OpenCode Orchestrator - Uninstalling...");
  if (isCI) log("Running in CI mode");
  log("Uninstallation started", { platform: process.platform, node: process.version });

  if (isCI) {
    console.log("ℹ️  CI environment detected. Skipping automatic plugin cleanup.");
    log("Skipping automatic plugin cleanup in CI");
    clearTimeout(timeoutId);
    process.exit(0);
  }

  const configPaths = getConfigPaths(log);
  log("Config paths to check", configPaths);

  let removed = false;
  let backupCreated: string | null = null;

  for (const configDir of configPaths) {
    const configFile = resolveConfigFile(configDir);

    const result = removeFromConfig(configDir);
    if (result.success) {
      console.log(`✅ Plugin removed: ${configFile}`);
      if (result.backupFile) {
        console.log(`   Backup created: ${result.backupFile}`);
        backupCreated = result.backupFile;
      }
      removed = true;

      cleanupOldBackups(configFile, log);
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
  process.exit(0);
} finally {
  clearTimeout(timeoutId);
}
