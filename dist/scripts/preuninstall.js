#!/usr/bin/env node

// scripts/preuninstall.ts
import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
function formatError(err, context) {
  if (err instanceof Error) {
    const nodeErr = err;
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
var PLUGIN_NAME = "opencode-orchestrator";
function getConfigPaths() {
  const paths = [];
  if (process.env.XDG_CONFIG_HOME) {
    paths.push(join(process.env.XDG_CONFIG_HOME, "opencode"));
  }
  if (process.platform === "win32") {
    const appDataPath = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    paths.push(join(appDataPath, "opencode"));
    const dotConfigPath = join(homedir(), ".config", "opencode");
    if (!paths.includes(dotConfigPath)) {
      paths.push(dotConfigPath);
    }
  } else {
    paths.push(join(homedir(), ".config", "opencode"));
  }
  return paths;
}
function removeFromConfig(configDir) {
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
      (p) => !p.includes(PLUGIN_NAME)
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
  console.log("\u{1F9F9} OpenCode Orchestrator - Uninstalling...");
  const configPaths = getConfigPaths();
  let removed = false;
  for (const configDir of configPaths) {
    const configFile = join(configDir, "opencode.json");
    if (removeFromConfig(configDir)) {
      console.log(`\u2705 Plugin removed: ${configFile}`);
      removed = true;
    }
  }
  if (!removed) {
    console.log("\u2705 Plugin was not registered. Nothing to clean up.");
  }
} catch (error) {
  console.error(formatError(error, "clean up config"));
  process.exit(0);
}
