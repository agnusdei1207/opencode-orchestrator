/**
 * Session Manager Unit Tests
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    ensureSessionInitialized,
    updateSessionTokens,
} from "../../src/core/orchestrator/session-manager";
import { state } from "../../src/core/orchestrator/state";
import { writeLoopState } from "../../src/core/loop/mission-loop";

describe("Session Manager", () => {
    const tempDirs: string[] = [];

    afterEach(() => {
        state.sessions.clear();
        state.missionActive = false;
        for (const dir of tempDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("creates a complete managed session for an empty context map", () => {
        const sessions = new Map<string, unknown>();

        const session = ensureSessionInitialized(sessions, "session-1");

        expect(session.active).toBe(true);
        expect(session.step).toBe(0);
        expect(session.tokens).toEqual({ totalInput: 0, totalOutput: 0, estimatedCost: 0 });
        expect(sessions.get("session-1")).toBe(session);
    });

    it("normalizes partial existing session objects without replacing them", () => {
        const existing: Record<string, unknown> = {
            active: false,
            step: 3,
            lastUserMessageAt: 123,
        };
        const sessions = new Map<string, unknown>([["session-1", existing]]);

        const session = ensureSessionInitialized(sessions, "session-1");

        expect(session).toBe(existing);
        expect(session.active).toBe(false);
        expect(session.step).toBe(3);
        expect(session.timestamp).toEqual(expect.any(Number));
        expect(session.startTime).toEqual(expect.any(Number));
        expect(session.lastStepTime).toEqual(expect.any(Number));
        expect(session.tokens).toEqual({ totalInput: 0, totalOutput: 0, estimatedCost: 0 });
    });

    it("rehydrates step and start time from persisted mission loop state", () => {
        const directory = createTempDir(tempDirs);
        const startedAt = "2026-06-11T00:00:00.000Z";
        writeLoopState(directory, {
            active: true,
            iteration: 7,
            maxIterations: 10,
            prompt: "Build",
            objective: "Build",
            sessionID: "session-1",
            startedAt,
        });
        const sessions = new Map<string, unknown>();

        const session = ensureSessionInitialized(sessions, "session-1", directory);

        expect(session.step).toBe(7);
        expect(session.startTime).toBe(new Date(startedAt).getTime());
    });

    it("updates token usage on normalized sessions at the session root", () => {
        const sessions = new Map<string, unknown>([["session-1", { active: true }]]);

        updateSessionTokens(sessions, "session-1", 9, 12);
        const session = sessions.get("session-1") as {
            tokens: { totalInput: number; totalOutput: number; estimatedCost: number; active?: unknown };
        };

        expect(session.tokens.totalInput).toBe(3);
        expect(session.tokens.totalOutput).toBe(3);
        expect(session.tokens.estimatedCost).toBeGreaterThan(0);
        expect(session.tokens.active).toBeUndefined();
    });
});

function createTempDir(registry: string[]): string {
    const directory = mkdtempSync(path.join(tmpdir(), "oco-session-manager-"));
    registry.push(directory);
    return directory;
}
