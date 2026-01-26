#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from "fs";
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
 * Create backup of existing config file
 */
function createBackup(configFile: string): boolean {
  try {
    if (!existsSync(configFile)) return true;

    const backupFile = `${configFile}.backup.${Date.now()}`;
    const content = readFileSync(configFile, "utf-8");
    writeFileSync(backupFile, content);
    log("Backup created", { backupFile });
    return true;
  } catch (err) {
    log("Backup creation failed", { error: String(err) });
    return false;
  }
}

/**
 * Register plugin in a single config file (SAFE MERGE)
 */
function registerInConfig(configDir: string): boolean {
  const configFile = join(configDir, "opencode.json");

  try {
    // Create config directory if not exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
      log("Config directory created", { configDir });
    }

    let config: Record<string, any> = {};
    let isNewFile = false;

    // Read existing config or create new
    if (existsSync(configFile)) {
      try {
        const content = readFileSync(configFile, "utf-8").trim();

        // Handle empty file
        if (!content) {
          config = {};
          log("Empty config file detected, creating new config");
        } else {
          config = JSON.parse(content);
          log("Existing config loaded", { keys: Object.keys(config) });
        }
      } catch (parseErr) {
        // Corrupted JSON - create backup and start fresh
        log("Config parse error, creating backup", { error: String(parseErr) });
        createBackup(configFile);
        config = {};
      }
    } else {
      isNewFile = true;
      log("No config file found, creating new");
    }

    // Preserve all existing config properties
    // Ensure plugin array exists
    if (!config.plugin) {
      config.plugin = [];
    }

    // Ensure it's an array
    if (!Array.isArray(config.plugin)) {
      log("Invalid plugin field (not array), resetting", { current: config.plugin });
      config.plugin = [];
    }

    // Check if plugin already registered
    const hasPlugin = config.plugin.some((p: string) => {
      if (typeof p !== "string") return false;
      return p === PLUGIN_NAME || p.includes(PLUGIN_NAME);
    });

    if (hasPlugin) {
      log("Plugin already registered", { plugins: config.plugin });
      return false;
    }

    // Add plugin (safe merge)
    config.plugin.push(PLUGIN_NAME);

    // Preserve $schema if it exists, or add default
    if (!config.$schema) {
      config.$schema = "https://opencode.ai/config.json";
    }

    // Create backup before writing (if file exists)
    if (!isNewFile) {
      createBackup(configFile);
    }

    // Write config with proper formatting
    const configContent = JSON.stringify(config, null, 2) + "\n";
    writeFileSync(configFile, configContent, { encoding: "utf-8", mode: 0o644 });

    log("Config written successfully", {
      configFile,
      isNewFile,
      plugins: config.plugin,
      allKeys: Object.keys(config)
    });

    return true;
  } catch (err) {
    log("registerInConfig failed", {
      error: String(err),
      code: (err as NodeError).code
    });
    return false;
  }
}

try {
  console.log("🎯 OpenCode Orchestrator - Installing...");
  console.log("");
  log("Installation started", { platform: process.platform, node: process.version });

  const configPaths = getConfigPaths();
  log("Config paths to check", configPaths);

  let registered = false;
  let alreadyRegistered = false;
  let configsChecked = 0;
  let registeredPath = "";

  for (const configDir of configPaths) {
    const configFile = join(configDir, "opencode.json");
    configsChecked++;

    // Check if already registered in this config
    if (existsSync(configFile)) {
      try {
        const content = readFileSync(configFile, "utf-8").trim();
        if (content) {
          const config = JSON.parse(content);
          if (config.plugin?.some((p: string) => p.includes(PLUGIN_NAME))) {
            console.log(`✅ Already registered in: ${configFile}`);
            log("Already registered", { configFile });
            alreadyRegistered = true;
            registeredPath = configFile;
            continue;
          }
        }
      } catch (err) {
        log("Parse error checking existing config", { configFile, error: String(err) });
        // Continue to try registration (will handle corrupted file)
      }
    }

    // Try to register in this config
    if (registerInConfig(configDir)) {
      console.log(`✅ Plugin registered in: ${configFile}`);
      console.log("   📝 Your existing settings have been preserved");

      // Check if any backup was created
      try {
        const files = readdirSync(configDir);
        const hasBackup = files.some(f => f.startsWith("opencode.json.backup."));
        if (hasBackup) {
          console.log("   💾 Backup created for safety");
        }
      } catch {
        // Ignore
      }
      log("Plugin registered successfully", { configFile });
      registered = true;
      registeredPath = configFile;
      break; // Stop after first successful registration
    }
  }

  console.log("");

  // Summary
  if (registered) {
    console.log("✅ Installation successful!");
    console.log(`   Config file: ${registeredPath}`);
  } else if (alreadyRegistered) {
    console.log("✅ Plugin already installed!");
    console.log(`   Config file: ${registeredPath}`);
  } else {
    console.log("⚠️  Could not register plugin automatically.");
    console.log("");
    console.log("   Please manually add to your OpenCode config:");
    console.log(`   ${configPaths[0]}/opencode.json`);
    console.log("");
    console.log("   Add this line:");
    console.log(`   "plugin": ["${PLUGIN_NAME}"]`);
    console.log("");
    log("Failed to register plugin in any location", { configsChecked, paths: configPaths });
  }

  console.log("");
  console.log("🚀 Next steps:");
  console.log("   1. Restart OpenCode");
  console.log("   2. Try /task command in your project");
  console.log("");

  log("Installation completed", {
    registered,
    alreadyRegistered,
    configsChecked,
    registeredPath
  });
} catch (error) {
  console.log("");
  console.error("❌ Installation error:");
  console.error("   " + formatError(error, "register plugin"));
  console.log("");
  console.log("   Please report this issue at:");
  console.log("   https://github.com/agnusdei1207/opencode-orchestrator/issues");
  console.log("");
  log("Installation error", { error: String(error), stack: error instanceof Error ? error.stack : undefined });
  process.exit(0); // Exit gracefully to not break npm install
}
