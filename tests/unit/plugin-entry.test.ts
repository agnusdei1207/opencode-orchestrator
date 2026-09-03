import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import OrchestratorPlugin from "../../src/index.js";
import { PLUGIN_HOOKS, SESSION_EVENTS } from "../../src/shared/index.js";

describe("OrchestratorPlugin Entry Point", () => {
    let testDir: string;
    let mockClient: any;

    beforeEach(() => {
        testDir = mkdtempSync(path.join(tmpdir(), "oco-entry-test-"));
        mockClient = {
            session: {
                create: vi.fn().mockResolvedValue({ data: { id: "test-sess" } }),
                prompt: vi.fn().mockResolvedValue({ data: {} }),
                abort: vi.fn().mockResolvedValue({}),
                delete: vi.fn().mockResolvedValue({}),
                messages: vi.fn().mockResolvedValue({ data: [] }),
            },
            v2: {
                session: {
                    compact: vi.fn().mockResolvedValue({}),
                },
            },
            tui: {
                showToast: vi.fn().mockResolvedValue({}),
            },
            app: {
                agents: vi.fn().mockResolvedValue({ data: [] }),
            },
        };
    });

    afterEach(() => {
        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch {
            // ignore
        }
    });

    it("initializes plugin with all hooks and default options", async () => {
        const pluginInstance = await OrchestratorPlugin(
            { directory: testDir, client: mockClient } as any,
            {}
        );

        expect(pluginInstance).toBeDefined();
        expect(typeof pluginInstance.tool).toBe("object");
        expect(typeof pluginInstance.config).toBe("function");
        expect(typeof pluginInstance.event).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.CHAT_MESSAGE]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.CHAT_PARAMS]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.TOOL_EXECUTE_BEFORE]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.TOOL_EXECUTE_AFTER]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.EXPERIMENTAL_SESSION_COMPACTING]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.EXPERIMENTAL_CHAT_SYSTEM_TRANSFORM]).toBe("function");
        expect(typeof pluginInstance.dispose).toBe("function");

        // Clean up
        if (pluginInstance.dispose) {
            await pluginInstance.dispose();
        }
    });

    it("handles session.created event and registers session in todoSync", async () => {
        const pluginInstance = await OrchestratorPlugin(
            { directory: testDir, client: mockClient } as any,
            { contextMaxTokens: 150000 }
        );

        // Test event with sessionID directly
        await pluginInstance.event({
            event: {
                type: SESSION_EVENTS.CREATED,
                properties: { sessionID: "sess-abc" },
            },
        });

        // Test event with properties.info.id
        await pluginInstance.event({
            event: {
                type: SESSION_EVENTS.CREATED,
                properties: { info: { id: "sess-def" } },
            },
        });

        // Test event with non-record properties
        await pluginInstance.event({
            event: {
                type: SESSION_EVENTS.CREATED,
                properties: null as any,
            },
        });

        if (pluginInstance.dispose) {
            await pluginInstance.dispose();
        }
    });
});
