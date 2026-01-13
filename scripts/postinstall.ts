#!/usr/bin/env node

/**
 * OpenCode Orchestrator - Post-install script
 * Automatically registers the plugin with OpenCode
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_FILE = join(CONFIG_DIR, "opencode.json");
const PLUGIN_NAME = "opencode-orchestrator";

function getPluginPath() {
    // Find where this package is installed (absolute path)
    try {
        // Get the directory where this script is located
        const scriptPath = new URL(".", import.meta.url).pathname;
        // Go up from scripts/ to package root
        const packageRoot = join(scriptPath, "..");
        return packageRoot.replace(/\/$/, "");
    } catch {
        return PLUGIN_NAME;
    }
}

function install() {
    console.log("🦀 OpenCode Orchestrator - Installing...");

    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Load or create config
    let config: Record<string, any> = {};
    if (existsSync(CONFIG_FILE)) {
        try {
            config = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
        } catch {
            config = {};
        }
    }

    // Add plugin if not already present
    if (!config.plugin) {
        config.plugin = [];
    }

    const pluginPath = getPluginPath();

    // Remove old entries and add the new absolute path
    config.plugin = config.plugin.filter((p: string) =>
        !p.includes("opencode-orchestrator") && p !== PLUGIN_NAME
    );
    config.plugin.push(pluginPath);

    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log("✅ Plugin registered!");
    console.log(`   Path: ${pluginPath}`);
    console.log(`   Config: ${CONFIG_FILE}`);

    console.log("");
    console.log("🚀 Ready! Restart OpenCode to use.");
    console.log("");
    console.log("Command:");
    console.log("  /auto \"task\"   - The only command you need");
    console.log("");
}

install();
