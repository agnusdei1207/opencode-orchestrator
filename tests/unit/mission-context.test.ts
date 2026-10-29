import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMissionContextBuilder } from "../../src/plugin-handlers/mission-context.js";
import { startMissionLoop, writeLoopState, readLoopState } from "../../src/core/loop/mission-loop.js";
import type { PluginSessionState } from "../../src/plugin-handlers/context.js";
import { log } from "../../src/core/agents/logger.js";

vi.mock("../../src/core/agents/logger.js", () => ({ log: vi.fn() }));

describe("mission context builder", () => {
    let directory: string;
    let sessions: Map<string, PluginSessionState>;
    let build: ReturnType<typeof createMissionContextBuilder>;
    const agents = { getTasksByParent: vi.fn((): Array<{ status: string }> => []) };

    beforeEach(() => {
        directory = mkdtempSync(path.join(tmpdir(), "oco-mission-context-"));
        sessions = new Map();
        agents.getTasksByParent.mockReset().mockReturnValue([]);
        build = createMissionContextBuilder({ directory, sessions, agents: agents as never });
    });
    afterEach(() => {
        vi.restoreAllMocks();
        rmSync(directory, { recursive: true, force: true });
    });

    it("includes mission rules, objective, memory and rehydrated step count", () => {
        startMissionLoop(directory, "owner", "Build the feature");
        const text = build("owner");
        expect(text).toContain("MISSION LOOP ACTIVE: Iteration 1\n");
        expect(text).toContain("Build the feature");
        expect(text).toContain("parent status: completed");
        expect(text).toContain("If .opencode/verification-checklist.md exists");
        expect(text).toContain("Steps executed: 1");
        expect(text).toContain("<mission_scratchpad");
        expect(sessions.get("owner")?.step).toBe(1);
    });

    it("reads fresh step, iteration and verification on every request", () => {
        startMissionLoop(directory, "owner", "Build");
        build("owner");
        sessions.get("owner")!.step = 42;
        writeLoopState(directory, { ...readLoopState(directory)!, iteration: 8, lastVerificationSummary: "tests passed" });
        const text = build("owner");
        expect(text).toContain("Steps executed: 42");
        expect(text).toContain("MISSION LOOP ACTIVE: Iteration 8\n");
        expect(text).toContain("Last verification: tests passed");
    });

    it("reports pending and running tasks but excludes completed tasks", () => {
        startMissionLoop(directory, "owner", "Build");
        agents.getTasksByParent.mockReturnValue([{ status: "running" }, { status: "pending" }, { status: "completed" }]);
        expect(build("owner")).toContain("Running: 1\n- Pending: 1");
    });

    it("skips missing, inactive and foreign missions without creating sessions", () => {
        expect(build(undefined)).toBeUndefined();
        expect(build("owner")).toBeUndefined();
        startMissionLoop(directory, "owner", "Build");
        expect(build("child")).toBeUndefined();
        writeLoopState(directory, { ...readLoopState(directory)!, active: false });
        expect(build("owner")).toBeUndefined();
        expect(sessions.size).toBe(0);
    });

    it("continues when background task inspection fails", () => {
        startMissionLoop(directory, "owner", "Build");
        agents.getTasksByParent.mockImplementation(() => { throw new Error("unavailable"); });
        expect(build("owner")).toContain("MISSION LOOP ACTIVE");
        expect(log).toHaveBeenCalledWith(expect.stringContaining("Failed to inspect background tasks for owner"));
    });

    it("continues when the optional scratchpad cannot be read", () => {
        startMissionLoop(directory, "owner", "Build");
        const scratchpad = path.join(directory, ".opencode/docs/brain/scratchpad.md");
        rmSync(scratchpad);
        mkdirSync(scratchpad);
        expect(build("owner")).toContain("MISSION LOOP ACTIVE");
        expect(log).toHaveBeenCalledWith(expect.stringContaining("Failed to read optional mission scratchpad"));
    });

    it("uses the latest scratchpad snapshot", () => {
        startMissionLoop(directory, "owner", "Build");
        writeFileSync(path.join(directory, ".opencode/docs/brain/scratchpad.md"), "Updated scratchpad");
        expect(build("owner")).toContain("Updated scratchpad");
    });
});
