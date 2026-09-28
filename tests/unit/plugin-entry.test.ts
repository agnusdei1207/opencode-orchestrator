import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import OrchestratorPlugin from "../../src/index.js";
import { PATHS, PLUGIN_HOOKS, SESSION_EVENTS } from "../../src/shared/index.js";

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

    it("exports one hybrid module for OpenCode 1 and OpenCode 2", () => {
        expect(OrchestratorPlugin.id).toBe("opencode-orchestrator");
        expect(typeof OrchestratorPlugin.server).toBe("function");
        expect(typeof OrchestratorPlugin.setup).toBe("function");
    });

    it("initializes plugin with all hooks and default options", async () => {
        const pluginInstance = await OrchestratorPlugin.server(
            { directory: testDir, client: mockClient } as any,
            {}
        );

        expect(pluginInstance).toBeDefined();
        expect(typeof pluginInstance.tool).toBe("object");
        expect(typeof pluginInstance.config).toBe("function");
        expect(typeof pluginInstance.event).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.CHAT_MESSAGE]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.CHAT_PARAMS]).toBe("function");
        expect(typeof pluginInstance["command.execute.before"]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.TOOL_EXECUTE_BEFORE]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.TOOL_EXECUTE_AFTER]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.EXPERIMENTAL_SESSION_COMPACTING]).toBe("function");
        expect(typeof pluginInstance[PLUGIN_HOOKS.EXPERIMENTAL_CHAT_SYSTEM_TRANSFORM]).toBe("function");
        expect(typeof pluginInstance["experimental.text.complete"]).toBe("function");
        expect(typeof pluginInstance.dispose).toBe("function");

        // Clean up
        if (pluginInstance.dispose) {
            await pluginInstance.dispose();
        }
    });

    it("removes only a standalone model thinking closer from completed text", async () => {
        const pluginInstance = await OrchestratorPlugin.server(
            { directory: testDir, client: mockClient } as Parameters<typeof OrchestratorPlugin.server>[0],
            {},
        );
        try {
            const hook = pluginInstance["experimental.text.complete"];
            expect(typeof hook).toBe("function");
            const input = { sessionID: "session-1", messageID: "message-1", partID: "part-1" };
            const cases = [
                { text: "</assistant-thinking></think>", expected: "" },
                { text: "  </assistant-thinking></think>\r\n", expected: "" },
                { text: "</assistant-thinking></think>\nAnswer", expected: "</assistant-thinking></think>\nAnswer" },
                { text: "Answer </assistant-thinking></think>", expected: "Answer </assistant-thinking></think>" },
                { text: "```xml\n</assistant-thinking></think>\n```", expected: "```xml\n</assistant-thinking></think>\n```" },
                { text: "</think>\nAnswer", expected: "</think>\nAnswer" },
            ];
            for (const { text, expected } of cases) {
                const output = { text };
                await hook?.(input, output);
                expect(output.text).toBe(expected);
            }
        } finally {
            await pluginInstance.dispose?.();
        }
    });

    it("does not create a placeholder TODO file during initialization", async () => {
        const pluginInstance = await OrchestratorPlugin.server(
            { directory: testDir, client: mockClient } as Parameters<typeof OrchestratorPlugin.server>[0],
            {},
        );

        try {
            expect(existsSync(path.join(testDir, PATHS.TODO))).toBe(false);
        } finally {
            await pluginInstance.dispose?.();
        }
    });

    it("leaves extension discovery and plugin files to OpenCode", async () => {
        const pluginDir = path.join(testDir, ".opencode", "plugins");
        mkdirSync(pluginDir, { recursive: true });
        const marker = path.join(testDir, "unexpected-import.txt");
        const pluginPath = path.join(pluginDir, "host-plugin.js");
        const source = `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(marker)}, 'imported');
export default { name: 'host-owned', version: '1' };`;
        writeFileSync(pluginPath, source);
        const instance = await OrchestratorPlugin.server(
            { directory: testDir, client: mockClient } as Parameters<typeof OrchestratorPlugin.server>[0], {},
        );
        try {
            expect(existsSync(marker)).toBe(false);
            expect(readFileSync(pluginPath, "utf8")).toBe(source);
        } finally {
            await instance.dispose?.();
        }
    });

    it("preserves an existing TODO file during initialization", async () => {
        const todoPath = path.join(testDir, PATHS.TODO);
        const original = "# User mission\r\n\r\n- [ ] Preserve this task\r\n";
        mkdirSync(path.dirname(todoPath), { recursive: true });
        writeFileSync(todoPath, original);

        const pluginInstance = await OrchestratorPlugin.server(
            { directory: testDir, client: mockClient } as Parameters<typeof OrchestratorPlugin.server>[0],
            {},
        );

        try {
            expect(readFileSync(todoPath, "utf8")).toBe(original);
        } finally {
            await pluginInstance.dispose?.();
        }
    });

    it("handles session.created event with direct and nested session IDs", async () => {
        const pluginInstance = await OrchestratorPlugin.server(
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
