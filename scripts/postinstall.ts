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
    // Find where this package is installed
    try {
        const packagePath = new URL(".", import.meta.url).pathname;
        return packagePath.replace(/\/$/, "");
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
    const hasPlugin = config.plugin.some((p: string) =>
        p === PLUGIN_NAME || p === pluginPath || p.includes("opencode-orchestrator")
    );

    if (!hasPlugin) {
        config.plugin.push(PLUGIN_NAME);
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log("✅ Plugin registered!");
        console.log(`   Config: ${CONFIG_FILE}`);
    } else {
        console.log("✅ Plugin already registered.");
    }

    console.log("");
    console.log("🚀 Ready! Restart OpenCode to use.");
    console.log("");
    console.log("Commands:");
    console.log("Commands:");
    console.log("  /auto \"task\"   - The only command you need");
    console.log("");
}

install();
