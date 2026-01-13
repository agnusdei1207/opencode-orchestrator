#!/usr/bin/env node

// scripts/postinstall.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var CONFIG_DIR = join(homedir(), ".config", "opencode");
var CONFIG_FILE = join(CONFIG_DIR, "opencode.json");
var PLUGIN_NAME = "opencode-orchestrator";
function getPluginPath() {
  try {
    const scriptPath = new URL(".", import.meta.url).pathname;
    const packageRoot = join(scriptPath, "..");
    return packageRoot.replace(/\/$/, "");
  } catch {
    return PLUGIN_NAME;
  }
}
function install() {
  console.log("\uD83E\uDD80 OpenCode Orchestrator - Installing...");
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
  config.plugin = config.plugin.filter((p) => !p.includes("opencode-orchestrator") && p !== PLUGIN_NAME);
  config.plugin.push(pluginPath);
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log("✅ Plugin registered!");
  console.log(`   Path: ${pluginPath}`);
  console.log(`   Config: ${CONFIG_FILE}`);
  console.log("");
  console.log("\uD83D\uDE80 Ready! Restart OpenCode to use.");
  console.log("");
  console.log("Command:");
  console.log('  /auto "task"   - The only command you need');
  console.log("");
}
install();
