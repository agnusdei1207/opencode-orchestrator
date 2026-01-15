#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
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
    console.log("🎯 OpenCode Orchestrator - Installing...");

    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }

    let config: Record<string, any> = {};
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

    const hasPlugin = config.plugin.some((p: string) => p.includes(PLUGIN_NAME));

    if (!hasPlugin) {
        config.plugin.push(PLUGIN_NAME);
        writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
        console.log("✅ Plugin registered!");
        console.log(`   Name: ${PLUGIN_NAME}`);
    } else {
        console.log("✅ Plugin already registered.");
    }

    console.log("");
    console.log("🚀 Ready! Restart OpenCode to use.");
    console.log("");
} catch (error) {
    console.error(formatError(error, "register plugin"));
    process.exit(0);
}
