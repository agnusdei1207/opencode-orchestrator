import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryLifecycle } from "../../../src/core/knowledge/memory-lifecycle.js";

describe("MemoryLifecycle - local Ebbinghaus memory operations", () => {
    let testDir: string;
    let lifecycle: MemoryLifecycle;

    beforeEach(() => {
        testDir = path.join(tmpdir(), `memory-lifecycle-${Date.now()}-${Math.random()}`);
        mkdirSync(testDir, { recursive: true });
        lifecycle = new MemoryLifecycle();
    });

    afterEach(() => {
        rmSync(testDir, { recursive: true, force: true });
    });

    it("records access by updating count, EMA, and timestamps", () => {
        const notePath = path.join(testDir, "memory.md");
        writeFileSync(notePath, [
            "---",
            "tags: [memory]",
            "memory_id: mem-access",
            "event_time: 2026-06-18T00:00:00Z",
            "ingestion_time: 2026-06-19T00:00:00Z",
            "access_count: 2",
            "access_ema: 1",
            "memory_layer: warm",
            "---",
            "# Memory",
        ].join("\n"));

        const changed = lifecycle.recordAccess(notePath, new Date("2026-06-19T12:00:00Z"));
        const updated = readFileSync(notePath, "utf8");

        expect(changed).toBe(true);
        expect(updated).toContain("access_count: 3");
        expect(updated).toContain("access_ema: 1");
        expect(updated).toContain("last_accessed: 2026-06-19T12:00:00.000Z");
        expect(updated).toContain("record_updated_at: 2026-06-19T12:00:00.000Z");
    });

    it("plans and applies tier changes without moving archives unless explicitly requested", () => {
        const hot = writeMemory("hot.md", "2026-06-19T00:00:00Z", "cold", "sop", 10);
        const stale = writeMemory("stale.md", "2024-01-01T00:00:00Z", "warm", "episode", 0);
        const pinned = writeMemory("pinned.md", "2024-01-01T00:00:00Z", "warm", "episode", 0, true);

        const plan = lifecycle.planLifecycle([hot, stale, pinned], new Date("2026-06-19T00:00:00Z"));

        expect(plan.tierChanges.map(item => [path.basename(item.filePath), item.to])).toEqual([
            ["hot.md", "hot"],
            ["stale.md", "archive"],
        ]);
        expect(plan.archiveCandidates.map(item => path.basename(item.filePath))).toEqual(["stale.md"]);
        expect(plan.protectedFiles).toEqual([pinned]);

        const changed = lifecycle.applyLifecyclePlan(testDir, plan, false, new Date("2026-06-19T00:00:00Z"));

        expect(changed).toEqual([hot, stale]);
        expect(existsSync(stale)).toBe(true);
        expect(readFileSync(stale, "utf8")).toContain("memory_layer: archive");
        expect(readFileSync(stale, "utf8")).toContain("tombstone: true");
    });

    it("resolves temporal supersession with valid_to and supersedes metadata", () => {
        const oldPath = path.join(testDir, "old.md");
        const newPath = path.join(testDir, "new.md");
        writeFileSync(oldPath, [
            "---",
            "memory_id: cve-1234",
            "title: CVE status",
            "event_time: 2024-03-15T00:00:00Z",
            "ingestion_time: 2024-03-20T00:00:00Z",
            "memory_layer: warm",
            "---",
            "Old risk status.",
        ].join("\n"));
        writeFileSync(newPath, [
            "---",
            "memory_id: cve-1234",
            "title: CVE status",
            "event_time: 2024-04-01T00:00:00Z",
            "ingestion_time: 2024-04-01T01:00:00Z",
            "memory_layer: warm",
            "---",
            "Patched status.",
        ].join("\n"));

        const supersessions = lifecycle.resolveTemporalSupersessions([oldPath, newPath], new Date("2026-06-19T00:00:00Z"));

        expect(supersessions).toEqual([{
            supersededFile: oldPath,
            supersedingFile: newPath,
            validTo: "2024-04-01T00:00:00Z",
            supersedesId: "cve-1234",
        }]);
        expect(readFileSync(oldPath, "utf8")).toContain("valid_to: 2024-04-01T00:00:00Z");
        expect(readFileSync(oldPath, "utf8")).toContain("memory_layer: archive");
        expect(readFileSync(oldPath, "utf8")).toContain("tombstone: true");
        expect(readFileSync(newPath, "utf8")).toContain("supersedes: [cve-1234]");
    });

    function writeMemory(fileName: string, lastAccessed: string, layer: string, kind: string, accessCount: number, keep = false): string {
        const notePath = path.join(testDir, fileName);
        writeFileSync(notePath, [
            "---",
            "tags: [memory]",
            `memory_id: ${fileName}`,
            "event_time: 2026-01-01T00:00:00Z",
            "ingestion_time: 2026-01-01T00:00:00Z",
            `last_accessed: ${lastAccessed}`,
            `access_count: ${accessCount}`,
            "importance: 1",
            "confidence: 1",
            `memory_kind: ${kind}`,
            `memory_layer: ${layer}`,
            `keep: ${keep}`,
            "---",
            "# Memory",
        ].join("\n"));
        return notePath;
    }
});
