import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CleanupScheduler } from "../../src/core/cleanup/cleanup-scheduler";
import * as DocumentCache from "../../src/core/cache/document-cache";
import { log } from "../../src/core/agents/logger";

vi.mock("../../src/core/cache/document-cache", () => ({
    cleanExpired: vi.fn(),
    stats: vi.fn(),
    list: vi.fn(),
    remove: vi.fn(),
}));

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

vi.mock("../../src/core/knowledge/memory-maintenance-runner", () => ({
    runMemoryMaintenancePass: vi.fn(() => ({ changedFiles: [] })),
}));

describe("CleanupScheduler", () => {
    let directory: string;
    let scheduler: CleanupScheduler;

    beforeEach(() => {
        vi.clearAllMocks();
        directory = mkdtempSync(path.join(tmpdir(), "oco-cleanup-"));
        scheduler = new CleanupScheduler(directory);
        vi.mocked(DocumentCache.cleanExpired).mockResolvedValue(0);
        vi.mocked(DocumentCache.stats).mockResolvedValue({
            totalDocuments: 0,
            totalSize: 0,
            expiredCount: 0,
            oldestDocument: null,
            newestDocument: null,
        });
        vi.mocked(DocumentCache.list).mockResolvedValue([]);
        vi.mocked(DocumentCache.remove).mockResolvedValue(true);
    });

    afterEach(() => {
        rmSync(directory, { recursive: true, force: true });
    });

    it("cleans expired document cache entries before size pruning", async () => {
        vi.mocked(DocumentCache.cleanExpired).mockResolvedValue(2);

        await scheduler.cleanDocs();

        expect(DocumentCache.cleanExpired).toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith("[Cleanup] Removed 2 expired cached document(s)");
    });

    it("logs document cache cleanup failures", async () => {
        vi.mocked(DocumentCache.cleanExpired).mockRejectedValue(new Error("cache unavailable"));

        await scheduler.cleanDocs();

        expect(log).toHaveBeenCalledWith(expect.stringContaining("Doc cleanup error"));
    });

    it("removes generated package artifacts with async cleanup helpers", async () => {
        const opencodeDir = path.join(directory, ".opencode");
        mkdirSync(path.join(opencodeDir, "node_modules"), { recursive: true });
        writeFileSync(path.join(opencodeDir, "package.json"), "{}");
        writeFileSync(path.join(opencodeDir, "bun.lock"), "");
        writeFileSync(path.join(opencodeDir, "package-lock.json"), "{}");

        await scheduler.cleanNodeModules();

        expect(existsSync(path.join(opencodeDir, "node_modules"))).toBe(false);
        expect(existsSync(path.join(opencodeDir, "package.json"))).toBe(false);
        expect(existsSync(path.join(opencodeDir, "bun.lock"))).toBe(false);
        expect(existsSync(path.join(opencodeDir, "package-lock.json"))).toBe(false);
    });

    it("rotates and compresses non-empty todo history", async () => {
        const archiveDir = path.join(directory, ".opencode", "archive");
        mkdirSync(archiveDir, { recursive: true });
        const historyPath = path.join(archiveDir, "todo_history.jsonl");
        writeFileSync(historyPath, '{"event":"done"}\n');

        await scheduler.rotateHistory();

        const date = new Date().toISOString().split("T")[0];
        expect(readFileSync(historyPath, "utf8")).toBe("");
        expect(existsSync(path.join(archiveDir, `todo_history.${date}.jsonl`))).toBe(false);
        expect(existsSync(path.join(archiveDir, `todo_history.${date}.jsonl.gz`))).toBe(true);
    });
});
