import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/core/agents/logger", () => ({
    log: vi.fn(),
}));

import { startMissionLoop } from "../../src/core/loop/mission-loop.js";
import { configureMissionRuntimeOptions, DEFAULT_MISSION_RUNTIME_OPTIONS } from "../../src/core/loop/mission-runtime-options.js";
import { KnowledgeContextProvider } from "../../src/core/knowledge/context-provider.js";
import { getMissionMemoryNotesDirPath } from "../../src/core/knowledge/mission-memory.js";
import { memoryStrength } from "../../src/core/knowledge/memory-scoring.js";
import { MemoryManager } from "../../src/core/memory/memory-manager.js";
import { MemoryLevel, type MemorySnapshot } from "../../src/core/memory/interfaces.js";

function readNoteByPrefix(notesDir: string, prefix: string): string {
    const file = fs.readdirSync(notesDir).find(name => name.startsWith(prefix) && name.endsWith(".md"));
    if (!file) throw new Error(`No generated note starting with "${prefix}" in ${notesDir}`);
    return fs.readFileSync(path.join(notesDir, file), "utf8");
}

const emptySnapshot: MemorySnapshot = {
    [MemoryLevel.SYSTEM]: [],
    [MemoryLevel.PROJECT]: [],
    [MemoryLevel.MISSION]: [],
    [MemoryLevel.TASK]: [],
};

describe("mission memory knowledge integration", () => {
    let testDir: string;
    let originalSnapshot: MemorySnapshot;

    beforeEach(() => {
        testDir = path.join(tmpdir(), `mission-memory-knowledge-${Date.now()}-${Math.random()}`);
        fs.mkdirSync(testDir, { recursive: true });
        configureMissionRuntimeOptions(DEFAULT_MISSION_RUNTIME_OPTIONS);
        originalSnapshot = structuredClone(MemoryManager.getInstance().export());
        MemoryManager.getInstance().import(structuredClone(emptySnapshot));
    });

    afterEach(() => {
        configureMissionRuntimeOptions(DEFAULT_MISSION_RUNTIME_OPTIONS);
        MemoryManager.getInstance().import(originalSnapshot);
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("projects relevant runtime memories into markdown notes that retrieval can search", () => {
        const memory = MemoryManager.getInstance();
        memory.add(
            MemoryLevel.MISSION,
            "Graphical memory timing should inject scratchpad context before retrieval so mission prompts stay grounded.",
            0.9,
        );
        memory.add(
            MemoryLevel.TASK,
            "Short-lived note about graphical memory verification evidence.",
            0.7,
        );

        const started = startMissionLoop(
            testDir,
            "mission-memory-session",
            "Investigate graphical memory timing and retrieval grounding",
        );

        expect(started).toBe(true);

        const notesDir = getMissionMemoryNotesDirPath(testDir);
        const noteFiles = fs.readdirSync(notesDir).filter(file => file.endsWith(".md"));
        expect(noteFiles.length).toBeGreaterThan(0);

        const firstNote = fs.readFileSync(path.join(notesDir, noteFiles[0]), "utf8");
        expect(firstNote).toContain("tags: [mission-memory, orchestrator");
        expect(firstNote).toContain("event_time:");
        expect(firstNote).toContain("ingestion_time:");
        expect(firstNote).toContain("## Content");

        const prompt = new KnowledgeContextProvider({ enableAccessWriteback: true }).buildPrompt(
            testDir,
            "graphical memory timing retrieval grounding",
        );

        expect(prompt).not.toBeNull();
        expect(prompt).toContain("brain/memories/");
        expect(prompt).not.toContain("brain/scratchpad.md");
        expect(prompt).toContain("Graphical memory timing");

        const accessedNote = fs.readFileSync(path.join(notesDir, noteFiles[0]), "utf8");
        expect(accessedNote).toContain("access_count: 2");
        expect(accessedNote).toContain("last_accessed:");
    });

    it("emits a valid decay profile (memory_kind + decay_lambda) on generated notes", () => {
        MemoryManager.getInstance().add(
            MemoryLevel.MISSION,
            "Mission scoped decision about retrieval grounding workflow.",
            0.9,
        );
        startMissionLoop(testDir, "decay-profile-session", "Investigate retrieval grounding");

        const note = readNoteByPrefix(getMissionMemoryNotesDirPath(testDir), "mission-");
        expect(note).toContain('memory_kind: "workflow"');
        expect(note).toContain("decay_lambda: 0.02");
        expect(note).not.toContain('memory_kind: "mission"');
    });

    it("omits keep for low-importance generated notes so they can decay", () => {
        MemoryManager.getInstance().add(
            MemoryLevel.TASK,
            "Short lived task finding about retrieval grounding evidence.",
            0.7,
        );
        startMissionLoop(testDir, "pin-low-session", "Investigate retrieval grounding");

        const note = readNoteByPrefix(getMissionMemoryNotesDirPath(testDir), "task-");
        expect(note).not.toContain("keep: true");
    });

    it("keeps high-importance generated notes pinned", () => {
        MemoryManager.getInstance().add(
            MemoryLevel.PROJECT,
            "Durable architectural decision about retrieval grounding.",
            0.95,
        );
        startMissionLoop(testDir, "pin-high-session", "Investigate retrieval grounding");

        const note = readNoteByPrefix(getMissionMemoryNotesDirPath(testDir), "project-");
        expect(note).toContain("keep: true");
    });

    it("decays an unpinned generated-style note after long disuse", () => {
        const now = Date.parse("2026-06-21T00:00:00Z");
        const stale = {
            importance: 0.7,
            confidence: 1,
            access_count: 1,
            memory_kind: "episode",
            decay_lambda: 0.07,
            ingestion_time: "2026-04-22T00:00:00Z",
            last_accessed: "2026-04-22T00:00:00Z",
        };
        expect(memoryStrength(stale, now)).toBeLessThan(0.9);
    });
});
