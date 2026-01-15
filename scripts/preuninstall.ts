#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface NodeError extends Error {
    code?: string;
}

function formatError(err: unknown, context: string): string {
    if (err instanceof Error) {
        const nodeErr = err as NodeError;
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

const CONFIG_DIR = process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "opencode")
    : process.platform === "win32"
        ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode")
        : join(homedir(), ".config", "opencode");
const CONFIG_FILE = join(CONFIG_DIR, "opencode.json");
const PLUGIN_NAME = "opencode-orchestrator";

try {
    console.log("🧹 OpenCode Orchestrator - Uninstalling...");

    if (!existsSync(CONFIG_FILE)) {
        console.log("✅ No config file found. Nothing to clean up.");
        process.exit(0);
    }

    const config = JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));

    if (!config.plugin || !Array.isArray(config.plugin)) {
        console.log("✅ No plugins registered. Nothing to clean up.");
        process.exit(0);
    }

    const originalLength = config.plugin.length;
    config.plugin = config.plugin.filter((p: string) => !p.includes(PLUGIN_NAME));

    if (config.plugin.length < originalLength) {
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
        console.log("✅ Plugin removed from OpenCode config.");
    } else {
        console.log("✅ Plugin was not registered. Nothing to clean up.");
    }
} catch (error) {
    console.error(formatError(error, "clean up config"));
    process.exit(0);
}
