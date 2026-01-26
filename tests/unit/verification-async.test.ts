/**
 * Async Verification Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import {
    verifyMissionCompletionAsync,
    verifyMissionCompletion,
    clearVerificationCache
} from "../../src/core/loop/verification.js";

describe("Async Verification", () => {
    let testDir: string;
    let opencodeDir: string;

    beforeEach(() => {
        // Use unique directory for each test to avoid cache collision
        testDir = join(tmpdir(), `test-verification-async-${Math.random().toString(36).substring(7)}`);
        opencodeDir = join(testDir, ".opencode");
        mkdirSync(opencodeDir, { recursive: true });

        // Clear global cache just in case
        clearVerificationCache();
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("should return correct result asynchronously", async () => {
        // Setup passing state
        writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
        writeFileSync(join(opencodeDir, "sync-issues.md"), "");

        const result = await verifyMissionCompletionAsync(testDir);

        expect(result.passed).toBe(true);
        expect(result.todoComplete).toBe(true);
    });

    it("should cache results correctly", async () => {
        // Setup passing state
        writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");

        // First call
        const result1 = await verifyMissionCompletionAsync(testDir);
        expect(result1.passed).toBe(true);

        // Modify file to failing state (should be ignored by cache if accessed via sync wrapper)
        // Note: verifyMissionCompletionAsync bypasses cache for READING files? 
        // No, readFileWithCache uses cache.

        // Wait < 5s. Update file content on disk.
        writeFileSync(join(opencodeDir, "todo.md"), "- [ ] Not Done");

        // Async call uses readFileWithCache.
        // If we call verifiedMissionCompletionAsync again immediately:
        // 1. readFileWithCache checks file cache. Returns cached content ("- [x] Done").
        // 2. Returns passed=true.

        const result2 = await verifyMissionCompletionAsync(testDir);
        expect(result2.passed).toBe(true); // Should still use cached file content
    });

    it("should refresh cache after TTL", async () => {
        vi.useFakeTimers();

        // Setup passing state
        writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");

        // Prime cache
        await verifyMissionCompletionAsync(testDir);

        // Change on disk
        writeFileSync(join(opencodeDir, "todo.md"), "- [ ] Not Done");

        // Advance time > 5s
        vi.advanceTimersByTime(6000);

        // Call again
        const result = await verifyMissionCompletionAsync(testDir);

        expect(result.passed).toBe(false); // Should read fresh file
        expect(result.todoComplete).toBe(false);

        vi.useRealTimers();
    });

    it("sync wrapper should use cached result", async () => {
        // Prime cache via async call
        writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
        await verifyMissionCompletionAsync(testDir);

        // Change disk to failing
        writeFileSync(join(opencodeDir, "todo.md"), "- [ ] Not Done");

        // Sync wrapper call - should hit cache
        // Note: wrapper uses `lastVerificationResult` map, 
        // while async function updates `lastVerificationResult`.
        const result = verifyMissionCompletion(testDir);

        expect(result.passed).toBe(true);
    });
});
