#!/usr/bin/env node

// scripts/preuninstall.ts
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var CONFIG_DIR = process.env.XDG_CONFIG_HOME ? join(process.env.XDG_CONFIG_HOME, "opencode") : process.platform === "win32" ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode") : join(homedir(), ".config", "opencode");
var CONFIG_FILE = join(CONFIG_DIR, "opencode.json");
function uninstall() {
  try {
    console.log("\u{1F9F9} OpenCode Orchestrator - Uninstalling...");
    if (!existsSync(CONFIG_FILE)) {
      console.log("\u2705 No config file found. Nothing to clean up.");
      return;
    }
    try {
      const config = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
      if (!config.plugin || !Array.isArray(config.plugin)) {
        console.log("\u2705 No plugins registered. Nothing to clean up.");
        return;
      }
      const originalLength = config.plugin.length;
      config.plugin = config.plugin.filter(
        (p) => !p.includes("opencode-orchestrator")
      );
      if (config.plugin.length < originalLength) {
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log("\u2705 Plugin removed from OpenCode config.");
      } else {
        console.log("\u2705 Plugin was not registered. Nothing to clean up.");
      }
    } catch (error) {
      console.error("\u26A0\uFE0F  Could not clean up config:", error);
    }
    console.log("");
    console.log("Restart OpenCode to complete uninstallation.");
  } catch {
  }
}
uninstall();
