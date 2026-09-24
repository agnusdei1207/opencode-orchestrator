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

    it("registers native V2 agents, tools, commands, hooks, and cleanup", async () => {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-v2-test-"));
        directories.push(directory);
        const registrations: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];
        const agents = new Map<string, { id: string; description?: string; system?: string; mode: string; hidden: boolean }>();
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
            agent: {
                list: vi.fn().mockResolvedValue([]),
                transform: vi.fn((callback: (editor: { update: (id: string, edit: (agent: NonNullable<ReturnType<typeof agents.get>>) => void) => void }) => void) => {
                    callback({ update: (id, edit) => {
                        const agent = agents.get(id) ?? { id, mode: "all", hidden: false };
                        edit(agent);
                        agents.set(id, agent);
                    } });
                    return registration();
                }),
            },
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

        expect([...agents.keys()]).toEqual(["Commander", "Planner", "Worker", "Reviewer"]);
        expect(agents.get("Commander")).toMatchObject({ mode: "primary", hidden: false, system: expect.any(String) });
        expect(agents.get("Commander")?.system).toContain("You are Commander.");
        for (const name of ["Planner", "Worker", "Reviewer"]) {
            expect(agents.get(name)).toMatchObject({ mode: "subagent", hidden: true, system: expect.any(String) });
            expect(agents.get(name)?.system).toContain(`You are ${name}.`);
        }
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

    it("runs task as a synthetic instruction instead of a visible user prompt", async () => {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-v2-command-"));
        directories.push(directory);
        const commands: Array<{ name: string; execute: (input: unknown) => Promise<void> }> = [];
        const context = {
            session: { prompt: vi.fn(), synthetic: vi.fn().mockResolvedValue(undefined) },
            command: { transform: vi.fn(async (edit: (editor: { add: (command: typeof commands[number]) => void }) => void) => {
                edit({ add: command => commands.push(command) });
                return { dispose: vi.fn() };
            }) },
        } as unknown as Plugin.Context;
        const { registerV2Commands } = await import("../../src/v2/command-adapter.js");
        const handlerContext = { directory, sessions: new Map() } as unknown as Parameters<typeof registerV2Commands>[1];
        await registerV2Commands(context, handlerContext);
        await commands.find(command => command.name === "task")?.execute({ sessionID: "s1", prompt: { text: "do work" } });
        expect(context.session.synthetic).toHaveBeenCalledWith(expect.objectContaining({ sessionID: "s1" }));
        expect(context.session.prompt).not.toHaveBeenCalled();
    });

    it("applies configured temperature in the V2 generation context", async () => {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-v2-temperature-"));
        directories.push(directory);
        let contextHook: ((input: unknown) => Promise<void>) | undefined;
        const registration = async () => ({ dispose: vi.fn() });
        const context = {
            location: { directory, project: { directory } },
            options: { agentTemperatures: { Commander: 0.1 } },
            agent: { list: vi.fn().mockResolvedValue([]), transform: registration },
            session: { hook: vi.fn((name: string, callback: (input: unknown) => Promise<void>) => {
                if (name === "context") contextHook = callback;
                return registration();
            }) },
            tool: { hook: registration, transform: registration },
            command: { transform: registration },
            event: { subscribe: () => emptyEvents() },
        } as unknown as Plugin.Context;
        const cleanup = await OrchestratorPlugin.setup(context);
        const request = { sessionID: "s1", agent: "Commander", model: { providerID: "p", id: "m" }, system: [], options: { temperature: 0.7 } };
        await contextHook?.(request);
        expect(request.options.temperature).toBe(0.1);
        await cleanup?.();
    });
});

async function* emptyEvents(): AsyncGenerator<never> {
    return;
}
