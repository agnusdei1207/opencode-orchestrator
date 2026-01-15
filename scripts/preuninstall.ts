#!/usr/bin/env node

/**
 * OpenCode Orchestrator - Pre-uninstall script
 * Safely removes the plugin from OpenCode configuration
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : process.platform === "win32"
        ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode")
        : join(homedir(), ".config", "opencode");
const CONFIG_FILE = join(CONFIG_DIR, "opencode.json");

function uninstall() {
    try {
        console.log("🧹 OpenCode Orchestrator - Uninstalling...");

        if (!existsSync(CONFIG_FILE)) {
            console.log("✅ No config file found. Nothing to clean up.");
            return;
        }

        try {
            const config = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));

            if (!config.plugin || !Array.isArray(config.plugin)) {
                console.log("✅ No plugins registered. Nothing to clean up.");
                return;
            }

            // Filter out this plugin
            const originalLength = config.plugin.length;
            config.plugin = config.plugin.filter((p: string) =>
                !p.includes("opencode-orchestrator")
            );

            if (config.plugin.length < originalLength) {
                writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
                console.log("✅ Plugin removed from OpenCode config.");
            } else {
                console.log("✅ Plugin was not registered. Nothing to clean up.");
            }
        } catch (error) {
            console.error("⚠️  Could not clean up config:", error);
        }

        console.log("");
        console.log("Restart OpenCode to complete uninstallation.");
    } catch {
        // Silently fail
    }
}

uninstall();
