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
import { MemoryManager } from "../../src/core/memory/memory-manager.js";
import { MemoryLevel, type MemorySnapshot } from "../../src/core/memory/interfaces.js";

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

        const prompt = new KnowledgeContextProvider().buildPrompt(
            testDir,
            "graphical memory timing retrieval grounding",
        );

        expect(prompt).not.toBeNull();
        expect(prompt).toContain("brain/memories/");
        expect(prompt).not.toContain("brain/scratchpad.md");
        expect(prompt).toContain("Graphical memory timing");
    });
});
