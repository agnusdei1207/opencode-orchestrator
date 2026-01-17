#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
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
 * Register plugin in a single config file
 */
function registerInConfig(configDir: string): boolean {
  const configFile = join(configDir, "opencode.json");

  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    let config: Record<string, any> = {};
    if (existsSync(configFile)) {
      try {
        config = JSON.parse(readFileSync(configFile, "utf-8"));
      } catch {
        config = {};
      }
    }

    if (!config.plugin) {
      config.plugin = [];
    }

    const hasPlugin = config.plugin.some((p: string) =>
      p.includes(PLUGIN_NAME)
    );

    if (!hasPlugin) {
      config.plugin.push(PLUGIN_NAME);
      writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

try {
  console.log("🎯 OpenCode Orchestrator - Installing...");
  log("Installation started", { platform: process.platform });

  const configPaths = getConfigPaths();
  log("Config paths to check", configPaths);

  let registered = false;
  let alreadyRegistered = false;

  for (const configDir of configPaths) {
    const configFile = join(configDir, "opencode.json");

    // Check if already registered
    if (existsSync(configFile)) {
      try {
        const config = JSON.parse(readFileSync(configFile, "utf-8"));
        if (config.plugin?.some((p: string) => p.includes(PLUGIN_NAME))) {
          alreadyRegistered = true;
          continue;
        }
      } catch {
        // Ignore parse errors, will try to register
      }
    }

    if (registerInConfig(configDir)) {
      console.log(`✅ Plugin registered: ${configFile}`);
      log("Plugin registered successfully", { configFile });
      registered = true;
    }
  }

  if (!registered && alreadyRegistered) {
    console.log("✅ Plugin already registered.");
    log("Plugin was already registered");
  } else if (!registered) {
    console.log("⚠️ Could not register plugin in any config location.");
    log("Failed to register plugin in any location");
  }

  console.log("");
  console.log("🚀 Ready! Restart OpenCode to use.");
  console.log("");
  log("Installation completed", { registered, alreadyRegistered });
} catch (error) {
  log("Installation error", { error: String(error) });
  console.error(formatError(error, "register plugin"));
  process.exit(0);
}
