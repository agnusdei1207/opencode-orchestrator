import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, utimesSync } from "node:fs";
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
        scheduler.stop();
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

    it("cleans old sessions older than 7 days", async () => {
        const sessionArchivePath = path.join(directory, ".opencode/archive/tasks");
        mkdirSync(sessionArchivePath, { recursive: true });

        const oldFile = path.join(sessionArchivePath, "old_session.jsonl");
        const newFile = path.join(sessionArchivePath, "new_session.jsonl");
        writeFileSync(oldFile, "{}\n");
        writeFileSync(newFile, "{}\n");

        // Set oldFile mtime to 10 days ago
        const tenDaysAgo = (Date.now() - 10 * 24 * 3600 * 1000) / 1000;
        utimesSync(oldFile, tenDaysAgo, tenDaysAgo);

        await scheduler.cleanOldSessions();

        expect(existsSync(oldFile)).toBe(false);
        expect(existsSync(newFile)).toBe(true);
    });

    it("compactWAL runs without errors", async () => {
        await expect(scheduler.compactWAL()).resolves.toBeUndefined();
    });

    it("starts and stops scheduled tasks", () => {
        scheduler.start();
        expect((scheduler as any).intervals.size).toBeGreaterThan(0);
        scheduler.stop();
        expect((scheduler as any).intervals.size).toBe(0);
    });
});
