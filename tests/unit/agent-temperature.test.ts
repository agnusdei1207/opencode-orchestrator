import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseOrchestratorOptions } from "../../src/core/config/options.js";
import { setupPlugin } from "../../src/host/plugin.js";

async function* emptyEvents(): AsyncGenerator<never> {
    return;
}

describe("agent temperature options", () => {
    const directories: string[] = [];

    afterEach(() => {
        for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
    });

    async function setupWithTemperatures(agentTemperatures: unknown) {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-temperature-"));
        directories.push(directory);
        let contextHook: ((input: unknown) => Promise<void>) | undefined;
        const registration = async () => ({ dispose: vi.fn() });
        const context = {
            location: { directory, project: { directory } },
            options: { agentTemperatures },
            agent: { list: vi.fn().mockResolvedValue([]), transform: registration },
            session: {
                hook: vi.fn((name: string, callback: (input: unknown) => Promise<void>) => {
                    if (name === "context") contextHook = callback;
                    return registration();
                }),
            },
            tool: { hook: registration, transform: registration },
            command: { transform: registration },
            model: { list: vi.fn().mockResolvedValue({ data: [] }) },
            event: { subscribe: () => emptyEvents() },
        } as unknown as Plugin.Context;
        const cleanup = await setupPlugin(context);
        const run = async (agent: string) => {
            const request = { sessionID: "s1", agent, model: { providerID: "p", id: "m" }, system: [], options: { temperature: 0.7 } };
            await contextHook!(request);
            return request.options.temperature;
        };
        return { run, cleanup };
    }

    it("accepts finite per-agent temperatures and ignores invalid values", () => {
        const options = parseOrchestratorOptions({
            agentTemperatures: { Commander: 0.1, Planner: -1, Worker: "warm", Reviewer: 3 },
        });
        expect(options.agentTemperatures).toEqual({ Commander: 0.1 });
    });

    it("defaults to no temperature overrides", () => {
        expect(parseOrchestratorOptions(undefined).agentTemperatures).toEqual({});
        expect(parseOrchestratorOptions({ agentTemperatures: [0.1] }).agentTemperatures).toEqual({});
    });

    it("applies a configured temperature in the generation context", async () => {
        const { run, cleanup } = await setupWithTemperatures({ Commander: 0.1 });
        try {
            expect(await run("Commander")).toBe(0.1);
        } finally {
            await cleanup();
        }
    });

    it("leaves unconfigured agents at the host temperature", async () => {
        const { run, cleanup } = await setupWithTemperatures({ Commander: 0.1 });
        try {
            expect(await run("Worker")).toBe(0.7);
            // Inherited object keys are not agent configuration.
            expect(await run("toString")).toBe(0.7);
        } finally {
            await cleanup();
        }
    });
});
