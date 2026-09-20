import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import OrchestratorPlugin from "../../src/index.js";

describe("OpenCode 2 plugin setup", () => {
    const directories: string[] = [];

    afterEach(() => {
        for (const directory of directories.splice(0)) {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    it("registers native V2 tools, commands, hooks, and cleanup", async () => {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-v2-test-"));
        directories.push(directory);
        const registrations: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
        const tools: Array<{ name?: string }> = [];
        const commands: Array<{ name?: string }> = [];
        const hookNames: string[] = [];
        const registration = () => {
            const value = { dispose: vi.fn().mockResolvedValue(undefined) };
            registrations.push(value);
            return Promise.resolve(value);
        };
        const context = {
            location: { directory, project: { directory } },
            options: {},
            agent: { list: vi.fn().mockResolvedValue([]) },
            session: {
                create: vi.fn(), prompt: vi.fn(), synthetic: vi.fn(), interrupt: vi.fn(), context: vi.fn(),
                hook: vi.fn((name: string) => { hookNames.push(`session.${name}`); return registration(); }),
            },
            tool: {
                transform: vi.fn((callback: (editor: { add: (tool: { name?: string }) => void }) => void) => {
                    callback({ add: tool => tools.push(tool) });
                    return registration();
                }),
                hook: vi.fn((name: string) => { hookNames.push(`tool.${name}`); return registration(); }),
            },
            command: {
                transform: vi.fn((callback: (editor: { add: (command: { name?: string }) => void }) => void) => {
                    callback({ add: command => commands.push(command) });
                    return registration();
                }),
            },
            event: { subscribe: () => emptyEvents() },
        } as unknown as Plugin.Context;

        const cleanup = await OrchestratorPlugin.setup(context);

        expect(tools.some(tool => tool.name === "delegate_task")).toBe(true);
        expect(commands.map(command => command.name)).toEqual(expect.arrayContaining([
            "task", "plan", "agents", "stop", "cancel",
        ]));
        expect(hookNames).toEqual(expect.arrayContaining([
            "session.prompt", "session.context", "session.compaction",
            "tool.execute.before", "tool.execute.after",
        ]));
        expect(cleanup).toBeTypeOf("function");
        await cleanup?.();
        expect(registrations.every(item => item.dispose.mock.calls.length === 1)).toBe(true);
    });
});

async function* emptyEvents(): AsyncGenerator<never> {
    return;
}
