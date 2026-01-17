#!/usr/bin/env node

// scripts/postinstall.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { homedir, tmpdir } from "os";
import { join } from "path";
var LOG_FILE = join(tmpdir(), "opencode-orchestrator.log");
function log(message, data) {
  try {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const entry = `[${timestamp}] [postinstall] ${message} ${data ? JSON.stringify(data) : ""}
`;
    appendFileSync(LOG_FILE, entry);
  } catch {
  }
}
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
function registerInConfig(configDir) {
  const configFile = join(configDir, "opencode.json");
  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    let config = {};
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
    const hasPlugin = config.plugin.some(
      (p) => p.includes(PLUGIN_NAME)
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
  console.log("\u{1F3AF} OpenCode Orchestrator - Installing...");
  log("Installation started", { platform: process.platform });
  const configPaths = getConfigPaths();
  log("Config paths to check", configPaths);
  let registered = false;
  let alreadyRegistered = false;
  for (const configDir of configPaths) {
    const configFile = join(configDir, "opencode.json");
    if (existsSync(configFile)) {
      try {
        const config = JSON.parse(readFileSync(configFile, "utf-8"));
        if (config.plugin?.some((p) => p.includes(PLUGIN_NAME))) {
          alreadyRegistered = true;
          continue;
        }
      } catch {
      }
    }
    if (registerInConfig(configDir)) {
      console.log(`\u2705 Plugin registered: ${configFile}`);
      log("Plugin registered successfully", { configFile });
      registered = true;
    }
  }
  if (!registered && alreadyRegistered) {
    console.log("\u2705 Plugin already registered.");
    log("Plugin was already registered");
  } else if (!registered) {
    console.log("\u26A0\uFE0F Could not register plugin in any config location.");
    log("Failed to register plugin in any location");
  }
  console.log("");
  console.log("\u{1F680} Ready! Restart OpenCode to use.");
  console.log("");
  log("Installation completed", { registered, alreadyRegistered });
} catch (error) {
  log("Installation error", { error: String(error) });
  console.error(formatError(error, "register plugin"));
  process.exit(0);
}
