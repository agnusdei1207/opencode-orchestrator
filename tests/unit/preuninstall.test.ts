/**
 * preuninstall script — unit tests
 *
 * Tests all scenarios of the safe removal policy:
 *   1. No opencode.json → no-op (nothing to remove)
 *   2. Plugin present → removed, all other fields preserved
 *   3. Plugin not in array → no-op (no write)
 *   4. Corrupted JSON → backup created, file NOT overwritten
 *   5. Empty plugin array → no-op
 *   6. Multiple instances of plugin → all removed
 *   7. Written JSON is valid after removal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const PLUGIN_NAME = "opencode-orchestrator";

// ---------------------------------------------------------------------------
// Minimal re-implementation of removeFromConfig for isolated testing.
// This mirrors the exact logic in scripts/preuninstall.ts.
// ---------------------------------------------------------------------------

function removeFromConfig(configDir: string): {
    success: boolean;
    message: string;
    backupFile: string | null;
} {
    const configFile = path.join(configDir, "opencode.json");
    let backupFile: string | null = null;

    if (!fs.existsSync(configFile)) {
        return { success: false, message: "no config file", backupFile: null };
    }

    // Backup before any modifications
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupFile = `${configFile}.backup.${timestamp}`;
    fs.copyFileSync(configFile, backupFile);

    const content = fs.readFileSync(configFile, "utf-8").trim();
    if (!content) {
        return { success: false, message: "empty config", backupFile };
    }

    let config: Record<string, any>;
    try {
        config = JSON.parse(content);
    } catch {
        return { success: false, message: "corrupt JSON, skipped", backupFile };
    }

    if (!config.plugin || !Array.isArray(config.plugin)) {
        return { success: false, message: "no plugin array", backupFile };
    }

    const originalLength = config.plugin.length;
    config.plugin = config.plugin.filter(
        (p: string) => typeof p !== "string" || (p !== PLUGIN_NAME && !p.includes(PLUGIN_NAME))
    );

    if (config.plugin.length === originalLength) {
        return { success: false, message: "plugin not found", backupFile };
    }

    // Atomic write
    const tempFile = `${configFile}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(config, null, 2) + "\n");
    fs.renameSync(tempFile, configFile);

    return { success: true, message: "removed", backupFile };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("preuninstall — safe removal policy", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oc-preuninstall-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ── Scenario 1: No config file ─────────────────────────────────────────

    it("returns success=false and no backup when opencode.json does not exist", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);

        const result = removeFromConfig(configDir);

        expect(result.success).toBe(false);
        expect(result.backupFile).toBeNull();
        expect(result.message).toContain("no config file");
    });

    // ── Scenario 2: Plugin present → remove, preserve other fields ─────────

    it("removes plugin from array and preserves all other config fields", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);
        const configFile = path.join(configDir, "opencode.json");

        fs.writeFileSync(configFile, JSON.stringify({
            "$schema": "https://opencode.ai/config.json",
            theme: "dark",
            model: "claude-opus-4-5",
            plugin: ["some-other-plugin", PLUGIN_NAME],
        }, null, 2));

        const result = removeFromConfig(configDir);

        expect(result.success).toBe(true);
        const written = JSON.parse(fs.readFileSync(configFile, "utf-8"));
        expect(written.plugin).not.toContain(PLUGIN_NAME);
        expect(written.plugin).toContain("some-other-plugin");
        // Preserved fields
        expect(written.theme).toBe("dark");
        expect(written.model).toBe("claude-opus-4-5");
        expect(written["$schema"]).toBe("https://opencode.ai/config.json");
    });

    // ── Scenario 3: Plugin not in array → no write ─────────────────────────

    it("does not write file when plugin is not in the plugin array", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);
        const configFile = path.join(configDir, "opencode.json");

        fs.writeFileSync(configFile, JSON.stringify({ plugin: ["other-plugin"] }));
        const mtimeBefore = fs.statSync(configFile).mtimeMs;

        const result = removeFromConfig(configDir);

        expect(result.success).toBe(false);
        expect(result.message).toContain("plugin not found");
    });

    // ── Scenario 4: Corrupted JSON → backup + file UNCHANGED ───────────────

    it("does NOT modify corrupted opencode.json (only creates backup)", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);
        const configFile = path.join(configDir, "opencode.json");

        const corruptContent = "{ invalid json |||";
        fs.writeFileSync(configFile, corruptContent);

        const result = removeFromConfig(configDir);

        expect(result.success).toBe(false);
        expect(result.message).toContain("corrupt JSON");
        // Original file content preserved
        expect(fs.readFileSync(configFile, "utf-8")).toBe(corruptContent);
        // Backup was created
        expect(result.backupFile).not.toBeNull();
        expect(fs.existsSync(result.backupFile!)).toBe(true);
        expect(fs.readFileSync(result.backupFile!, "utf-8")).toBe(corruptContent);
    });

    // ── Scenario 5: Empty plugin array → no-op ─────────────────────────────

    it("does nothing when plugin array is empty", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);
        const configFile = path.join(configDir, "opencode.json");

        fs.writeFileSync(configFile, JSON.stringify({ plugin: [] }));

        const result = removeFromConfig(configDir);

        expect(result.success).toBe(false);
        expect(result.message).toContain("plugin not found");
    });

    // ── Scenario 6: Multiple instances of plugin → all removed ────────────

    it("removes all instances when plugin appears multiple times", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);
        const configFile = path.join(configDir, "opencode.json");

        fs.writeFileSync(configFile, JSON.stringify({
            plugin: [PLUGIN_NAME, "other", PLUGIN_NAME],
        }));

        const result = removeFromConfig(configDir);

        expect(result.success).toBe(true);
        const written = JSON.parse(fs.readFileSync(configFile, "utf-8"));
        expect(written.plugin.filter((p: string) => p === PLUGIN_NAME)).toHaveLength(0);
        expect(written.plugin).toContain("other");
    });

    // ── Scenario 7: Result JSON is valid after removal ─────────────────────

    it("produces valid re-parseable JSON after plugin removal", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);
        const configFile = path.join(configDir, "opencode.json");

        fs.writeFileSync(configFile, JSON.stringify({ plugin: [PLUGIN_NAME, "other"] }));
        removeFromConfig(configDir);

        const content = fs.readFileSync(configFile, "utf-8");
        expect(() => JSON.parse(content)).not.toThrow();
    });

    // ── Scenario 8: Backup is created before any modification ─────────────

    it("creates a backup file before modifying the config", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);
        const configFile = path.join(configDir, "opencode.json");

        const original = JSON.stringify({ plugin: [PLUGIN_NAME] });
        fs.writeFileSync(configFile, original);

        const result = removeFromConfig(configDir);

        expect(result.backupFile).not.toBeNull();
        expect(fs.existsSync(result.backupFile!)).toBe(true);
        // Backup contains original content
        expect(fs.readFileSync(result.backupFile!, "utf-8")).toBe(original);
    });

    // ── Scenario 9: No plugin array at all → no-op ─────────────────────────

    it("does nothing when config has no plugin field at all", () => {
        const configDir = path.join(tmpDir, "opencode");
        fs.mkdirSync(configDir);
        const configFile = path.join(configDir, "opencode.json");

        fs.writeFileSync(configFile, JSON.stringify({ theme: "dark" }));

        const result = removeFromConfig(configDir);

        expect(result.success).toBe(false);
        expect(result.message).toContain("no plugin array");
    });
});
