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
    getMissionMemoryNotesDirPath,
    readMissionScratchpadSnapshot,
    syncMissionMemory,
} from "../../src/core/knowledge/mission-memory.js";
import { parseFrontmatter } from "../../src/core/knowledge/mission-note.js";
import { MemoryLevel, MemoryManager } from "../../src/core/memory/memory-manager.js";

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

    it("syncs memory notes from MemoryManager and cleans obsolete notes", () => {
        const memoryManager = MemoryManager.getInstance(testDir);
        const originalEntries = structuredClone(memoryManager.export());
        try {
            memoryManager.import({
                [MemoryLevel.SYSTEM]: [],
                [MemoryLevel.PROJECT]: [],
                [MemoryLevel.MISSION]: [],
                [MemoryLevel.TASK]: [],
            });

            // Add project, mission, and task memories
            memoryManager.add(
                MemoryLevel.PROJECT,
                "Project memory architecture guidelines for multi-agent missions",
                0.95,
            );
            memoryManager.add(
                MemoryLevel.MISSION,
                "Mission memory active focus note for graphical memory verification",
                0.85,
            );
            memoryManager.add(
                MemoryLevel.TASK,
                "Task memory transient result note",
                0.6,
            );

            const loopState = {
                active: true,
                iteration: 1,
                prompt: "multi-agent graphical memory verification",
                objective: "Verify mission memory synchronization",
                sessionID,
                startedAt: new Date().toISOString(),
            };

            const synced = syncMissionMemory(testDir, loopState);
            expect(synced).toBe(true);

            const notesDir = getMissionMemoryNotesDirPath(testDir);
            expect(fs.existsSync(notesDir)).toBe(true);

            const noteFiles = fs.readdirSync(notesDir).filter(f => f.endsWith(".md"));
            expect(noteFiles.length).toBeGreaterThanOrEqual(2);

            // Read one note and verify frontmatter
            const projectNote = noteFiles.find(f => f.startsWith("project-"));
            expect(projectNote).toBeDefined();
            const projectContent = fs.readFileSync(path.join(notesDir, projectNote!), "utf8");
            const parsed = parseFrontmatter(projectContent);
            expect(parsed.tags).toContain("mission-memory");
            expect(parsed.tags).toContain("orchestrator");
            expect(parsed.keep).toBe(true);
            expect(parsed.level).toBe("project");
            expect(parsed.importance).toBe(0.95);
            expect(parsed.session).toBe(sessionID);

            const userNote = "project-user-written.md";
            fs.writeFileSync(path.join(notesDir, userNote), "# My own project notes\n", "utf8");

            // An empty MemoryManager is what a plugin restart looks like. Resync must
            // drop only unpinned generated notes.
            memoryManager.import({
                [MemoryLevel.SYSTEM]: [],
                [MemoryLevel.PROJECT]: [],
                [MemoryLevel.MISSION]: [],
                [MemoryLevel.TASK]: [],
            });
            syncMissionMemory(testDir, loopState);
            const remainingNotes = fs.readdirSync(notesDir).filter(f => f.startsWith("project-") || f.startsWith("mission-") || f.startsWith("task-"));
            expect(remainingNotes.sort()).toEqual([projectNote!, userNote].sort());
        } finally {
            memoryManager.import(originalEntries);
        }
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

    it("parses diverse yaml frontmatter safely", () => {
        const withoutFrontmatter = parseFrontmatter("Just plain markdown body");
        expect(withoutFrontmatter).toEqual({});

        const yamlContent = `---
title: "Test Note"
count: 42
rate: 3.14
active: true
disabled: false
empty: null
alt_empty: ~
tags: [alpha, beta, "gamma"]
# Comment line
invalid_line_without_colon
---
Body text`;

        const parsed = parseFrontmatter(yamlContent);
        expect(parsed.title).toBe("Test Note");
        expect(parsed.count).toBe(42);
        expect(parsed.rate).toBe(3.14);
        expect(parsed.active).toBe(true);
        expect(parsed.disabled).toBe(false);
        expect(parsed.empty).toBeNull();
        expect(parsed.alt_empty).toBeNull();
        expect(parsed.tags).toEqual(["alpha", "beta", "gamma"]);
    });
});
