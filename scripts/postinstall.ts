#!/usr/bin/env node

/**
 * OpenCode Orchestrator - Post-install script
 * Automatically registers the plugin with OpenCode
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const CONFIG_DIR = join(homedir(), ".config", "opencode");
const CONFIG_FILE = join(CONFIG_DIR, "opencode.json");
const PLUGIN_NAME = "opencode-orchestrator";

function getPluginPath() {
    try {
        // Cross-platform safe path retrieval (handles Windows C:\ well)
        let currentDir = dirname(fileURLToPath(import.meta.url));

        // Search upwards for package.json
        while (true) {
            if (existsSync(join(currentDir, "package.json"))) {
                return currentDir;
            }

            const parentDir = dirname(currentDir);
            // If parent is same as current, we've reached the filesystem root
            if (parentDir === currentDir) {
                break;
            }
            currentDir = parentDir;
        }
        // Fallback
        return PLUGIN_NAME;
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
        // CRITICAL: Must use absolute path!
        // OpenCode often fails to resolve plugins by package name depending on the Node environment (nvm, global prefix, etc.).
        // Registering the absolute path ensures it works 100% of the time.
        config.plugin.push(pluginPath);
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log("✅ Plugin registered!");
        console.log(`   Path: ${pluginPath}`);
        console.log(`   Config: ${CONFIG_FILE}`);
    } else {
        console.log("✅ Plugin already registered.");
    }

    console.log("");
    console.log("🚀 Ready! Restart OpenCode to use.");
    console.log("");
    console.log("Commands:");
    console.log("  /task \"goal\"   - Distributed Cognitive Task (PDCA Cycle)");
    console.log("  /plan \"task\"   - Decompose into atomic tasks");
    console.log("  /review        - Quality check");
    console.log("");
}

install();
