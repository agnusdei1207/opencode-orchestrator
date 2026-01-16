#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

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
    // Unix-like systems
    paths.push(join(homedir(), ".config", "opencode"));
  }

  return paths;
}

/**
 * Remove plugin from a single config file
 */
function removeFromConfig(configDir: string): boolean {
  const configFile = join(configDir, "opencode.json");

  try {
    if (!existsSync(configFile)) {
      return false;
    }

    const config = JSON.parse(readFileSync(configFile, "utf-8"));

    if (!config.plugin || !Array.isArray(config.plugin)) {
      return false;
    }

    const originalLength = config.plugin.length;
    config.plugin = config.plugin.filter(
      (p: string) => !p.includes(PLUGIN_NAME)
    );

    if (config.plugin.length < originalLength) {
      writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

try {
  console.log("🧹 OpenCode Orchestrator - Uninstalling...");

  const configPaths = getConfigPaths();
  let removed = false;

  for (const configDir of configPaths) {
    const configFile = join(configDir, "opencode.json");

    if (removeFromConfig(configDir)) {
      console.log(`✅ Plugin removed: ${configFile}`);
      removed = true;
    }
  }

  if (!removed) {
    console.log("✅ Plugin was not registered. Nothing to clean up.");
  }
} catch (error) {
  console.error(formatError(error, "clean up config"));
  process.exit(0);
}
