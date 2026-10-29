import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import * as entry from "../../src/index.js";
import OrchestratorPlugin from "../../src/index.js";
import { setupPlugin } from "../../src/host/plugin.js";
import { PATHS } from "../../src/shared/index.js";

async function* emptyEvents(): AsyncGenerator<never> {
    return;
}

function createHost(directory: string): Plugin.Context {
    const registration = async () => ({ dispose: vi.fn().mockResolvedValue(undefined) });
    return {
        location: { directory, project: { directory } },
        options: {},
        agent: { list: vi.fn().mockResolvedValue([]), transform: vi.fn(registration) },
        session: { hook: vi.fn(registration) },
        tool: { hook: vi.fn(registration), transform: vi.fn(registration) },
        command: { transform: vi.fn(registration) },
        model: { list: vi.fn().mockResolvedValue({ data: [] }) },
        event: { subscribe: () => emptyEvents() },
    } as unknown as Plugin.Context;
}

describe("OrchestratorPlugin Entry Point", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = mkdtempSync(path.join(tmpdir(), "oco-entry-test-"));
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    // OpenCode treats every module export as a plugin, so the entry may only
    // export the OpenCode 2 plugin object, and that object only `id` and `setup`.
    it("exports only a default OpenCode 2 plugin with id and setup", () => {
        expect(Object.keys(entry)).toEqual(["default"]);
        expect(Object.keys(OrchestratorPlugin).sort()).toEqual(["id", "setup"]);
        expect(OrchestratorPlugin.id).toBe("opencode-orchestrator");
        expect(OrchestratorPlugin.setup).toBe(setupPlugin);
        expect(OrchestratorPlugin).not.toHaveProperty("server");
    });

    it("sets up with default options and returns a cleanup function", async () => {
        const cleanup = await OrchestratorPlugin.setup(createHost(testDir));
        expect(cleanup).toBeTypeOf("function");
        await expect(cleanup()).resolves.toBeUndefined();
    });

    it("does not create a placeholder TODO file during initialization", async () => {
        const cleanup = await OrchestratorPlugin.setup(createHost(testDir));
        try {
            expect(existsSync(path.join(testDir, PATHS.TODO))).toBe(false);
        } finally {
            await cleanup();
        }
    });

    it("leaves extension discovery and plugin files to OpenCode", async () => {
        const pluginDir = path.join(testDir, ".opencode", "plugins");
        mkdirSync(pluginDir, { recursive: true });
        const marker = path.join(testDir, "unexpected-import.txt");
        const pluginPath = path.join(pluginDir, "host-plugin.js");
        const source = `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(marker)}, 'imported');
export default { id: 'host-owned', setup() {} };`;
        writeFileSync(pluginPath, source);
        const cleanup = await OrchestratorPlugin.setup(createHost(testDir));
        try {
            expect(existsSync(marker)).toBe(false);
            expect(readFileSync(pluginPath, "utf8")).toBe(source);
        } finally {
            await cleanup();
        }
    });

    it("preserves an existing TODO file during initialization", async () => {
        const todoPath = path.join(testDir, PATHS.TODO);
        const original = "# User mission\r\n\r\n- [ ] Preserve this task\r\n";
        mkdirSync(path.dirname(todoPath), { recursive: true });
        writeFileSync(todoPath, original);

        const cleanup = await OrchestratorPlugin.setup(createHost(testDir));
        try {
            expect(readFileSync(todoPath, "utf8")).toBe(original);
        } finally {
            await cleanup();
        }
    });
});
