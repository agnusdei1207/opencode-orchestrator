import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

vi.mock("../../src/shared/logger", () => ({
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
    readMissionScratchpadSnapshot,
    syncMissionMemory,
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

    // One OpenCode process can serve projects whose plugin options differ.
    it("applies each project's own mission options", () => {
        const otherDir = path.join(tmpdir(), `mission-runtime-other-${Date.now()}-${Math.random()}`);
        fs.mkdirSync(otherDir, { recursive: true });
        try {
            configureMissionRuntimeOptions({ ledger: false }, otherDir);
            configureMissionRuntimeOptions({ ledger: true }, testDir);
            const event = { type: "mission_started" as const, sessionID, iteration: 1, objective: "Scoped options" };

            expect(appendMissionLedgerEvent(testDir, event)).not.toBeNull();
            expect(appendMissionLedgerEvent(otherDir, event)).toBeNull();
            expect(fs.existsSync(getMissionLedgerPath(otherDir))).toBe(false);
        } finally {
            fs.rmSync(otherDir, { recursive: true, force: true });
        }
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
        expect(scratchpad).toContain("- Iteration: 1");
        expect(scratchpad).toMatch(/^- \S+ mission_cancelled: /mu);
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

    it("writes the newest maxEvidenceEvents ledger events to the scratchpad without a fixed cap", () => {
        configureMissionRuntimeOptions({ ...DEFAULT_MISSION_RUNTIME_OPTIONS, maxEvidenceEvents: 10 }, testDir);
        for (let iteration = 1; iteration <= 12; iteration++) {
            appendMissionLedgerEvent(testDir, {
                type: "continuation_scheduled",
                sessionID,
                iteration,
                summary: `evidence-${iteration}`,
            });
        }
        const loopState = {
            active: true,
            iteration: 12,
            prompt: "evidence window",
            objective: "Evidence window",
            sessionID,
            startedAt: new Date().toISOString(),
        };

        expect(syncMissionMemory(testDir, loopState)).toBe(true);

        const scratchpad = fs.readFileSync(getMissionScratchpadPath(testDir), "utf8");
        const evidence = scratchpad.split("\n").filter(line => / continuation_scheduled: /u.test(line));
        expect(evidence.map(line => line.split(": ").at(-1))).toEqual(
            Array.from({ length: 10 }, (_, index) => `evidence-${index + 3}`),
        );
        // Only the scratchpad and canvas are written; memory-note projection is gone.
        expect(fs.readdirSync(path.dirname(getMissionScratchpadPath(testDir))).sort())
            .toEqual(["knowledge-map.canvas", "scratchpad.md"]);
    });

    it("skips markdown memory when it is disabled", () => {
        configureMissionRuntimeOptions({ ...DEFAULT_MISSION_RUNTIME_OPTIONS, markdownMemory: false }, testDir);
        const synced = syncMissionMemory(testDir, {
            active: true, iteration: 1, prompt: "off", sessionID, startedAt: new Date().toISOString(),
        });
        expect(synced).toBe(false);
        expect(fs.existsSync(getMissionScratchpadPath(testDir))).toBe(false);
    });

    it("trims the ledger file to the newest 100 events on write", () => {
        for (let iteration = 1; iteration <= 105; iteration++) {
            appendMissionLedgerEvent(testDir, {
                type: "continuation_scheduled",
                sessionID,
                iteration,
                objective: "Bounded ledger",
            });
        }

        const lines = fs.readFileSync(getMissionLedgerPath(testDir), "utf8").split("\n").filter(Boolean);
        expect(lines).toHaveLength(100);
        const iterations = lines.map(line => (JSON.parse(line) as { iteration: number }).iteration);
        expect(iterations[0]).toBe(6);
        expect(iterations.at(-1)).toBe(105);
    });

    it("does not trim a ledger at the retention limit", () => {
        for (let iteration = 1; iteration <= 100; iteration++) {
            appendMissionLedgerEvent(testDir, { type: "continuation_scheduled", sessionID, iteration });
        }

        const lines = fs.readFileSync(getMissionLedgerPath(testDir), "utf8").split("\n").filter(Boolean);
        expect(lines).toHaveLength(100);
        expect((JSON.parse(lines[0]) as { iteration: number }).iteration).toBe(1);
    });

    it("reads scratchpad snapshot safely", () => {
        expect(readMissionScratchpadSnapshot(testDir)).toBeNull();

        const scratchpadPath = getMissionScratchpadPath(testDir);
        fs.mkdirSync(path.dirname(scratchpadPath), { recursive: true });
        fs.writeFileSync(scratchpadPath, "# Mission Scratchpad\n\nActive context.", "utf8");

        const snapshot = readMissionScratchpadSnapshot(testDir);
        expect(snapshot).toContain("Active context.");
    });
});
