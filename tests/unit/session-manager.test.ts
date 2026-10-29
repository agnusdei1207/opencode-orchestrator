import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureSessionInitialized } from "../../src/core/orchestrator/session-manager.js";
import { writeLoopState } from "../../src/core/loop/mission-loop.js";
import { ResourceControlHook } from "../../src/hooks/custom/resource-control.js";
import type { ToolInput, ToolOutput } from "../../src/hooks/registry.js";
import type { PluginSessionState } from "../../src/plugin-handlers/context.js";

describe("Session Manager", () => {
    const tempDirs: string[] = [];

    afterEach(() => {
        for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });

    it("creates a complete session state for an unknown session", () => {
        const sessions = new Map<string, PluginSessionState>();

        const session = ensureSessionInitialized(sessions, "session-1");

        expect(session.active).toBe(true);
        expect(session.step).toBe(0);
        expect(session.tokens).toEqual({ totalInput: 0, totalOutput: 0 });
        expect(sessions.get("session-1")).toBe(session);
    });

    it("returns the existing state unchanged", () => {
        const existing: PluginSessionState = {
            active: false, step: 3, startTime: 1, lastStepTime: 2, lastUserMessageAt: 123,
            tokens: { totalInput: 5, totalOutput: 6 },
        };
        const sessions = new Map([["session-1", existing]]);

        expect(ensureSessionInitialized(sessions, "session-1", createTempDir(tempDirs))).toBe(existing);
        expect(existing).toMatchObject({ active: false, step: 3, tokens: { totalInput: 5, totalOutput: 6 } });
    });

    it("rehydrates step and start time from the persisted mission it owns", () => {
        const directory = createTempDir(tempDirs);
        const startedAt = "2026-06-11T00:00:00.000Z";
        writeLoopState(directory, {
            active: true, iteration: 7, prompt: "Build", objective: "Build", sessionID: "session-1", startedAt,
        });
        const sessions = new Map<string, PluginSessionState>();

        const owner = ensureSessionInitialized(sessions, "session-1", directory);
        const other = ensureSessionInitialized(sessions, "session-2", directory);

        expect(owner.step).toBe(7);
        expect(owner.startTime).toBe(new Date(startedAt).getTime());
        expect(other.step).toBe(0);
    });

    it("accumulates the token estimate from every tool call, including the first", async () => {
        const sessions = new Map<string, PluginSessionState>();
        const hook = new ResourceControlHook();
        const ctx = { sessionID: "session-1", directory: "/tmp", sessions };
        // Payloads are measured by serialized length: 400 chars each, i.e. 100 tokens per call.
        const input: ToolInput = { content: "x".repeat(386) };
        const output: ToolOutput = { title: "read", output: "y".repeat(358), metadata: {} };
        expect(JSON.stringify(input)).toHaveLength(400);
        expect(JSON.stringify(output)).toHaveLength(400);

        for (let i = 0; i < 3; i++) await hook.execute(ctx, "read", input, output);

        expect(sessions.get("session-1")?.tokens).toEqual({ totalInput: 300, totalOutput: 300 });
    });
});

function createTempDir(registry: string[]): string {
    const directory = mkdtempSync(path.join(tmpdir(), "oco-session-manager-"));
    registry.push(directory);
    return directory;
}
