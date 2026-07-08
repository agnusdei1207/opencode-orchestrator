import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

import {
    cancelMissionLoop,
    startMissionLoop,
} from "../../src/core/loop/mission-loop.js";
import {
    appendMissionLedgerEvent,
    getMissionLedgerPath,
    readMissionLedger,
} from "../../src/core/loop/mission-ledger.js";
import {
    configureMissionRuntimeOptions,
    DEFAULT_MISSION_RUNTIME_OPTIONS,
} from "../../src/core/loop/mission-runtime-options.js";
import {
    getMissionCanvasPath,
    getMissionScratchpadPath,
} from "../../src/core/knowledge/mission-memory.js";

describe("mission runtime memory", () => {
    let testDir: string;
    const sessionID = "mission_memory_session";

    beforeEach(() => {
        testDir = path.join(tmpdir(), `mission-runtime-memory-${Date.now()}-${Math.random()}`);
        fs.mkdirSync(testDir, { recursive: true });
        configureMissionRuntimeOptions(DEFAULT_MISSION_RUNTIME_OPTIONS);
    });

    afterEach(() => {
        configureMissionRuntimeOptions(DEFAULT_MISSION_RUNTIME_OPTIONS);
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("writes a mission ledger, scratchpad, and canvas when a mission starts", () => {
        const started = startMissionLoop(testDir, sessionID, "Build graphical mission memory");

        expect(started).toBe(true);
        expect(fs.existsSync(getMissionLedgerPath(testDir))).toBe(true);
        expect(fs.existsSync(getMissionScratchpadPath(testDir))).toBe(true);
        expect(fs.existsSync(getMissionCanvasPath(testDir))).toBe(true);

        const events = readMissionLedger(testDir);
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            type: "mission_started",
            sessionID,
            iteration: 1,
            objective: "Build graphical mission memory",
        });

        const scratchpad = fs.readFileSync(getMissionScratchpadPath(testDir), "utf8");
        expect(scratchpad).toContain("tags: [scratchpad, mission, orchestrator]");
        expect(scratchpad).toContain("- Status: active");
        expect(scratchpad).toContain("- Objective: Build graphical mission memory");

        const canvas = JSON.parse(fs.readFileSync(getMissionCanvasPath(testDir), "utf8")) as {
            nodes: Array<{ id: string; text: string }>;
            edges: Array<{ id: string; fromNode: string; toNode: string }>;
        };
        expect(canvas.nodes.some(node => node.id === "objective" && node.text.includes("Build graphical mission memory"))).toBe(true);
        expect(canvas.edges.some(edge => edge.id === "objective-runtime")).toBe(true);
    });

    it("records inactive terminal state when a mission is cancelled", () => {
        startMissionLoop(testDir, sessionID, "Cancel with memory trail");

        const cancelled = cancelMissionLoop(testDir, sessionID);

        expect(cancelled).toBe(true);
        expect(readMissionLedger(testDir).map(event => event.type)).toEqual([
            "mission_started",
            "mission_cancelled",
        ]);

        const scratchpad = fs.readFileSync(getMissionScratchpadPath(testDir), "utf8");
        expect(scratchpad).toContain("- Status: inactive");
        expect(scratchpad).toContain("- Last continuation reason: cancelled");
    });

    it("respects runtime options that disable ledger and markdown memory", () => {
        configureMissionRuntimeOptions({
            ledger: false,
            markdownMemory: false,
            maxEvidenceEvents: 20,
        });

        startMissionLoop(testDir, sessionID, "Disabled memory mode");

        expect(fs.existsSync(getMissionLedgerPath(testDir))).toBe(false);
        expect(fs.existsSync(getMissionScratchpadPath(testDir))).toBe(false);
        expect(fs.existsSync(getMissionCanvasPath(testDir))).toBe(false);
        expect(readMissionLedger(testDir)).toEqual([]);
    });

    it("skips malformed ledger lines without failing valid event reads", () => {
        const first = appendMissionLedgerEvent(testDir, {
            type: "mission_started",
            sessionID,
            iteration: 1,
            objective: "Corrupt ledger tolerance",
        });

        fs.appendFileSync(getMissionLedgerPath(testDir), "not-json\n", "utf8");

        const second = appendMissionLedgerEvent(testDir, {
            type: "continuation_scheduled",
            sessionID,
            iteration: 2,
            objective: "Corrupt ledger tolerance",
        });

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(readMissionLedger(testDir).map(event => event.type)).toEqual([
            "mission_started",
            "continuation_scheduled",
        ]);
    });

    it("skips JSON ledger lines with invalid event shapes", () => {
        const first = appendMissionLedgerEvent(testDir, {
            type: "mission_started",
            sessionID,
            iteration: 1,
            objective: "Invalid ledger shape tolerance",
        });

        fs.appendFileSync(
            getMissionLedgerPath(testDir),
            [
                JSON.stringify({ id: "bad-type", type: "unknown", timestamp: "now", sessionID }),
                JSON.stringify({ id: "bad-iteration", type: "prompt_injected", timestamp: "now", sessionID, iteration: "2" }),
                JSON.stringify(["not", "an", "event"]),
                "",
            ].join("\n"),
            "utf8",
        );

        const second = appendMissionLedgerEvent(testDir, {
            type: "mission_completed",
            sessionID,
            iteration: 2,
            objective: "Invalid ledger shape tolerance",
        });

        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(readMissionLedger(testDir).map(event => event.type)).toEqual([
            "mission_started",
            "mission_completed",
        ]);
    });
});
