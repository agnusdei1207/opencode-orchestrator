import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    collectMemoryNotePaths,
    runMemoryMaintenancePass,
} from "../../../src/core/knowledge/memory-maintenance-runner.js";
import { getMissionMemoryNotesDirPath } from "../../../src/core/knowledge/mission-memory.js";

const STALE_NOTE = [
    "---",
    "importance: 0.7",
    "confidence: 1",
    "access_count: 1",
    'memory_kind: "episode"',
    "decay_lambda: 0.07",
    'ingestion_time: "2025-01-01T00:00:00Z"',
    'last_accessed: "2025-01-01T00:00:00Z"',
    'memory_layer: "warm"',
    "---",
    "# Task Memory",
    "stale content",
    "",
].join("\n");

const REPEATED_EPISODE = [
    "---",
    'memory_kind: "episodic"',
    'memory_layer: "warm"',
    'episode_key: "repeat-objective"',
    'objective: "Repeat objective"',
    'session: "episode-session-secret"',
    "episode_count: 2",
    "success_count: 2",
    'event_time: "2026-06-21T00:00:00Z"',
    "---",
    "# Episodic Memory",
    "",
    "Objective: Repeat objective",
    "## Evidence Trail",
    "- 2026-06-21T00:00:00.000Z mission_completed: token ghp_000000000000000000000000000000000000",
    "",
].join("\n");

describe("memory maintenance runner", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(tmpdir(), "mem-maint-"));
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("returns no paths when the memories dir is absent", () => {
        expect(collectMemoryNotePaths(testDir)).toEqual([]);
    });

    it("archives a long-unused unpinned note when applied", () => {
        const notesDir = getMissionMemoryNotesDirPath(testDir);
        fs.mkdirSync(notesDir, { recursive: true });
        const notePath = path.join(notesDir, "task-stale.md");
        fs.writeFileSync(notePath, STALE_NOTE);

        const result = runMemoryMaintenancePass(testDir, {
            apply: true,
            now: new Date("2026-06-21T00:00:00Z"),
        });

        expect(result.dryRun).toBe(false);
        expect(result.plan.tierChanges.some(change => change.to === "archive")).toBe(true);
        expect(fs.readFileSync(notePath, "utf8")).toContain("memory_layer: archive");
    });

    it("defaults to a dry run that does not mutate notes", () => {
        const notesDir = getMissionMemoryNotesDirPath(testDir);
        fs.mkdirSync(notesDir, { recursive: true });
        const notePath = path.join(notesDir, "task-stale2.md");
        fs.writeFileSync(notePath, STALE_NOTE);

        const result = runMemoryMaintenancePass(testDir, {
            now: new Date("2026-06-21T00:00:00Z"),
        });

        expect(result.dryRun).toBe(true);
        expect(result.changedFiles).toEqual([]);
        expect(result.promotions.changedFiles).toEqual([]);
        expect(fs.readFileSync(notePath, "utf8")).toContain('memory_layer: "warm"');
    });

    it("promotes repeated successful episodes with redacted generalized notes", () => {
        const notesDir = getMissionMemoryNotesDirPath(testDir);
        fs.mkdirSync(notesDir, { recursive: true });
        const episodePath = path.join(notesDir, "episodic-repeat-objective.md");
        fs.writeFileSync(episodePath, REPEATED_EPISODE);

        const result = runMemoryMaintenancePass(testDir, {
            apply: true,
            now: new Date("2026-06-22T00:00:00Z"),
        });

        const semanticPath = path.join(notesDir, "semantic-repeat-objective.md");
        const proceduralPath = path.join(notesDir, "procedural-repeat-objective.md");
        expect(result.changedFiles).toEqual([episodePath, proceduralPath, semanticPath].sort());
        expect(result.promotions.semanticPromotions).toEqual([semanticPath]);
        expect(result.promotions.proceduralPromotions).toEqual([proceduralPath]);
        expect(fs.existsSync(path.join(notesDir, "episodic-repeat-objective.md"))).toBe(true);
        expect(fs.readFileSync(semanticPath, "utf8")).toContain('memory_kind: "semantic"');
        expect(fs.readFileSync(semanticPath, "utf8")).not.toContain("ghp_000000000000000000000000000000000000");
        expect(fs.readFileSync(proceduralPath, "utf8")).toContain("## Failure Pivots");
    });
});
