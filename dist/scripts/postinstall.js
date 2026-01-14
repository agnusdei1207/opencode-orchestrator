#!/usr/bin/env node

// scripts/postinstall.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
var CONFIG_DIR = join(homedir(), ".config", "opencode");
var CONFIG_FILE = join(CONFIG_DIR, "opencode.json");
var PLUGIN_NAME = "opencode-orchestrator";
function getPluginPath() {
  try {
    let currentDir = dirname(fileURLToPath(import.meta.url));
    while (true) {
      if (existsSync(join(currentDir, "package.json"))) {
        return currentDir;
      }
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }
    return PLUGIN_NAME;
  } catch {
    return PLUGIN_NAME;
  }
}
function install() {
  console.log("\u{1F3AF} OpenCode Orchestrator - Installing...");
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  let config = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      config = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    } catch {
      config = {};
    }
  }
  if (!config.plugin) {
    config.plugin = [];
  }
  const pluginPath = getPluginPath();
  const hasPlugin = config.plugin.some(
    (p) => p === PLUGIN_NAME || p === pluginPath || p.includes("opencode-orchestrator")
  );
  if (!hasPlugin) {
    config.plugin.push(pluginPath);
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log("\u2705 Plugin registered!");
    console.log(`   Path: ${pluginPath}`);
  } else {
    console.log("\u2705 Plugin already registered.");
  }
  console.log("");
  console.log("\u{1F680} Ready! Restart OpenCode to use.");
  console.log("");
  console.log("Usage:");
  console.log("  Select 'Commander' agent or use /task command");
  console.log("  Commander runs until mission complete.");
  console.log("");
}
install();
