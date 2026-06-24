import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PluginManager } from "../../src/core/plugins/plugin-manager";
import { HookRegistry } from "../../src/hooks/registry";
import type { HookContext, ToolOutput } from "../../src/hooks/types";

interface PluginTestState {
    postCalls: number;
    cleanupCalls: number;
    initCalls: number;
}

const pluginModule = `
globalThis.__pluginManagerTest = globalThis.__pluginManagerTest ?? {
  postCalls: 0,
  cleanupCalls: 0,
  initCalls: 0,
};

const postTool = {
  name: "dynamic-post",
  execute: async () => {
    globalThis.__pluginManagerTest.postCalls += 1;
    return {};
  },
};

export default {
  name: "dynamic-plugin",
  version: "1.0.0",
  tools: {
    dynamic_echo: { description: "dynamic echo" },
  },
  hooks: { postTool },
  init: async () => {
    globalThis.__pluginManagerTest.initCalls += 1;
  },
  cleanup: async () => {
    globalThis.__pluginManagerTest.cleanupCalls += 1;
  },
};
`;

describe("PluginManager lifecycle", () => {
    let testDir: string;
    let manager: PluginManager;

    beforeEach(async () => {
        testDir = await mkdtemp(join(tmpdir(), "oco-plugin-manager-"));
        await mkdir(join(testDir, ".opencode", "plugins"), { recursive: true });
        await writeFile(join(testDir, ".opencode", "plugins", "dynamic.mjs"), pluginModule, "utf-8");

        resetGlobalPluginState();
        resetSingletons();
        manager = PluginManager.getInstance();
    });

    afterEach(async () => {
        await manager.shutdown();
        await rm(testDir, { recursive: true, force: true });
        resetGlobalPluginState();
        resetSingletons();
    });

    it("unregisters dynamic hooks and clears dynamic tools on shutdown", async () => {
        const registry = HookRegistry.getInstance();

        await manager.initialize(testDir);
        expect(Object.keys(manager.getDynamicTools())).toEqual(["dynamic_echo"]);

        await executePostTool(registry);
        expect(getGlobalPluginState().postCalls).toBe(1);

        await manager.shutdown();
        expect(manager.getDynamicTools()).toEqual({});
        expect(getGlobalPluginState().cleanupCalls).toBe(1);

        await executePostTool(registry);
        expect(getGlobalPluginState().postCalls).toBe(1);
    });

    it("cleans previous dynamic lifecycle before reinitializing", async () => {
        const registry = HookRegistry.getInstance();

        await manager.initialize(testDir);
        await manager.initialize(testDir);

        expect(getGlobalPluginState().cleanupCalls).toBe(1);
        expect(getGlobalPluginState().initCalls).toBe(2);
        expect(Object.keys(manager.getDynamicTools())).toEqual(["dynamic_echo"]);

        await executePostTool(registry);
        expect(getGlobalPluginState().postCalls).toBe(1);
    });
});

async function executePostTool(registry: HookRegistry): Promise<void> {
    const context: HookContext = {
        sessionID: "test-session",
        directory: "/tmp",
        sessions: new Map(),
    };
    const output: ToolOutput = {
        title: "tool",
        output: "result",
        metadata: {},
    };

    await registry.executePostTool(context, "tool", {}, output);
}

function getGlobalPluginState(): PluginTestState {
    return globalWithPluginState().__pluginManagerTest;
}

function resetGlobalPluginState(): void {
    globalWithPluginState().__pluginManagerTest = {
        postCalls: 0,
        cleanupCalls: 0,
        initCalls: 0,
    };
}

function resetSingletons(): void {
    (PluginManager as unknown as { instance?: PluginManager }).instance = undefined;
    (HookRegistry as unknown as { instance?: HookRegistry }).instance = undefined;
}

function globalWithPluginState(): typeof globalThis & { __pluginManagerTest: PluginTestState } {
    return globalThis as typeof globalThis & { __pluginManagerTest: PluginTestState };
}
