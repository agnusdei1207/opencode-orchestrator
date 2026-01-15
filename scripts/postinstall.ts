#!/usr/bin/env node

/**
 * OpenCode Orchestrator - Post-install script
 * Automatically registers the plugin with OpenCode
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const CONFIG_DIR = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : process.platform === "win32"
        ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode")
        : join(homedir(), ".config", "opencode");
const CONFIG_FILE = join(CONFIG_DIR, "opencode.json");
const PLUGIN_NAME = "opencode-orchestrator";

function getPluginPath() {
    try {
        let currentDir = dirname(fileURLToPath(import.meta.url));

        // Search upwards for package.json
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
    try {
        console.log("🎯 OpenCode Orchestrator - Installing...");

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

        // Initialize plugin array if needed
        if (!config.plugin) {
            config.plugin = [];
        }

        const pluginPath = getPluginPath();
        const hasPlugin = config.plugin.some((p: string) =>
            p === PLUGIN_NAME || p === pluginPath || p.includes("opencode-orchestrator")
        );

        if (!hasPlugin) {
            config.plugin.push(pluginPath);
            writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
            console.log("✅ Plugin registered!");
            console.log(`   Path: ${pluginPath}`);
        } else {
            console.log("✅ Plugin already registered.");
        }

        console.log("");
        console.log("🚀 Ready! Restart OpenCode to use.");
        console.log("");
        console.log("Usage:");
        console.log("  Select 'Commander' agent or use /task command");
        console.log("  Commander runs until mission complete.");
        console.log("");
    } catch (error) {
        // Silently fail on error to avoid breaking npm install
        // This is necessary because postinstall runs in various environments where
        // file access might be restricted or config structure might differ.
    }
}

install();
