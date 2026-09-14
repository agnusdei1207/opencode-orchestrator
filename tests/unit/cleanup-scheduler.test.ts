import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, utimesSync, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CleanupScheduler } from "../../src/core/cleanup/cleanup-scheduler";
import { log } from "../../src/core/agents/logger";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("CleanupScheduler", () => {
    let directory: string;
    let scheduler: CleanupScheduler;

    beforeEach(() => {
        vi.clearAllMocks();
        directory = mkdtempSync(path.join(tmpdir(), "oco-cleanup-"));
        scheduler = new CleanupScheduler(directory);
    });

    afterEach(() => {
        scheduler.stop();
        vi.useRealTimers();
        vi.restoreAllMocks();
        rmSync(directory, { recursive: true, force: true });
    });

    it("preserves host dependencies, user files, and historical data across startup and timers", async () => {
        const opencodeDir = path.join(directory, ".opencode");
        mkdirSync(path.join(opencodeDir, "node_modules"), { recursive: true });
        writeFileSync(path.join(opencodeDir, "node_modules", "host.js"), "host dependency");
        writeFileSync(path.join(opencodeDir, "package.json"), "{}");
        writeFileSync(path.join(opencodeDir, "bun.lock"), "");
        writeFileSync(path.join(opencodeDir, "package-lock.json"), "{}");
        const archiveDir = path.join(directory, ".opencode", "archive");
        mkdirSync(archiveDir, { recursive: true });
        const historyPath = path.join(archiveDir, "todo_history.jsonl");
        writeFileSync(historyPath, '{"event":"done"}\n');
        const userDir = path.join(opencodeDir, "plugins");
        mkdirSync(userDir);
        for (let i = 0; i < 520; i++) writeFileSync(path.join(userDir, `${i}.js`), `user ${i}`);

        vi.useFakeTimers();
        const remove = vi.spyOn(fs, "rm");
        const unlink = vi.spyOn(fs, "unlink");
        const rename = vi.spyOn(fs, "rename");
        scheduler.start();
        await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
        scheduler.stop();

        expect(remove).not.toHaveBeenCalled();
        expect(unlink).not.toHaveBeenCalled();
        expect(rename).not.toHaveBeenCalled();
        expect(readFileSync(path.join(opencodeDir, "node_modules", "host.js"), "utf8")).toBe("host dependency");
        for (const name of ["package.json", "bun.lock", "package-lock.json"]) expect(existsSync(path.join(opencodeDir, name))).toBe(true);
        expect(readFileSync(historyPath, "utf8")).toBe('{"event":"done"}\n');
        expect(readdirSync(userDir)).toHaveLength(520);
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

    it("schedules only task retention and stops it", async () => {
        vi.useFakeTimers();
        const cleanup = vi.spyOn(scheduler, "cleanOldSessions").mockResolvedValue();
        scheduler.start();
        scheduler.start();
        expect(vi.getTimerCount()).toBe(1);
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
        expect(cleanup).toHaveBeenCalledTimes(1);
        scheduler.stop();
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("logs archive read errors without failing cleanup", async () => {
        vi.spyOn(fs, "access").mockRejectedValueOnce(new Error("archive unavailable"));
        await expect(scheduler.cleanOldSessions()).resolves.toBeUndefined();
        expect(log).toHaveBeenCalledWith(expect.stringContaining("Session cleanup error: Error: archive unavailable"));
    });
});
