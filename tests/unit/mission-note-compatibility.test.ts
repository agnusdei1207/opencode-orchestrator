import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter } from "../../src/core/knowledge/mission-memory.js";
import { syncMissionEpisodeMemory } from "../../src/core/knowledge/mission-episode.js";
import type { MissionLoopState } from "../../src/shared/loop/types.js";

describe("mission note compatibility", () => {
    let directory: string;
    const now = "2026-09-14T00:00:00.000Z";
    const state: MissionLoopState = {
        active: false,
        iteration: 2,
        maxIterations: 10,
        prompt: "Verify mission notes",
        sessionID: "session-one",
        startedAt: "2026-09-13T00:00:00.000Z",
        lastContinuationReason: "mission_completed",
    };

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "mission-note-compatibility-"));
        vi.useFakeTimers();
        vi.setSystemTime(new Date(now));
    });

    afterEach(() => {
        vi.useRealTimers();
        rmSync(directory, { recursive: true, force: true });
    });

    it("preserves CRLF, scalar types, empty values and duplicate-key precedence", () => {
        const note = ["---", "# comment", "ignored", "", "count: 1", "count: 2",
            "empty:", "quoted: '42'", "enabled: true", "disabled: false", "nothing: ~",
            "nullValue: null", "tags: [alpha, 'beta', ,]", "---", "count: 99"].join("\r\n");
        expect(parseFrontmatter(note)).toEqual({ count: 2, empty: "", quoted: "42",
            enabled: true, disabled: false, nothing: null, nullValue: null, tags: ["alpha", "beta"] });
    });

    it("keeps the existing literal escape handling and incomplete-header fallback", () => {
        const literal = String.raw`a\\b\"c`;
        expect(parseFrontmatter(`---\ntitle: "${literal}"\n---`).title).toBe(literal);
        expect(parseFrontmatter("---\ntitle: incomplete")).toEqual({});
        expect(parseFrontmatter("body\n---\ntitle: later\n---")).toEqual({});
    });

    it("creates nested notes, filters evidence by session and replaces notes on resync", () => {
        const notes = join(directory, "nested", "memories");
        const notePath = syncMissionEpisodeMemory(notes, state, [{
            id: "completed", type: "mission_completed", sessionID: state.sessionID,
            timestamp: "2026-09-13T12:00:00.000Z", summary: "Verified result",
        }, {
            id: "unrelated", type: "mission_completed", sessionID: "other-session",
            timestamp: now, summary: "Unrelated result",
        }])!;
        const content = readFileSync(notePath, "utf8");
        expect(content).toContain("Verified result");
        expect(content).not.toContain("Unrelated result");
        expect(parseFrontmatter(content)).toMatchObject({ episode_count: 1, success_count: 1,
            event_time: "2026-09-13T12:00:00.000Z", ingestion_time: now, access_count: 1 });
        expect(syncMissionEpisodeMemory(notes, state, [])).toBe(notePath);
        expect(parseFrontmatter(readFileSync(notePath, "utf8")).episode_count).toBe(1);
        expect(readdirSync(notes)).toHaveLength(1);
    });

    it("preserves lifecycle metadata while counting a subsequent session once", () => {
        const notePath = syncMissionEpisodeMemory(directory, state, [])!;
        const original = readFileSync(notePath, "utf8");
        writeFileSync(notePath, original.replace(`ingestion_time: "${now}"`, 'ingestion_time: "older"')
            .replace(`last_accessed: "${now}"`, 'last_accessed: "previous"')
            .replace("access_count: 1", "access_count: 7").replace('memory_layer: "warm"', 'memory_layer: "cold"'));
        const next = { ...state, sessionID: "session-two" };
        syncMissionEpisodeMemory(directory, next, []);
        syncMissionEpisodeMemory(directory, next, []);
        expect(parseFrontmatter(readFileSync(notePath, "utf8"))).toMatchObject({
            episode_count: 2, success_count: 2, ingestion_time: "older",
            last_accessed: "previous", access_count: 7, memory_layer: "cold",
        });
    });

    it("falls back from invalid metadata and preserves escaped output", () => {
        const escaped = { ...state, objective: String.raw`Verify "C:\notes"` };
        const notePath = syncMissionEpisodeMemory(directory, escaped, [])!;
        expect(readFileSync(notePath, "utf8")).toContain(String.raw`objective: "Verify \"C:\\notes\""`);
        writeFileSync(notePath, "---\nepisode_count: Infinity\nsuccess_count: 'bad'\naccess_count: Infinity\n"
            + "ingestion_time: ' '\nlast_accessed: 7\nmemory_layer: false\n---\nold");
        syncMissionEpisodeMemory(directory, escaped, []);
        expect(parseFrontmatter(readFileSync(notePath, "utf8"))).toMatchObject({
            episode_count: 1, success_count: 1, access_count: 1,
            ingestion_time: now, last_accessed: now, memory_layer: "warm",
        });
    });

    it("does not write episodes for active or cancelled missions", () => {
        expect(syncMissionEpisodeMemory(directory, { ...state, active: true }, [])).toBeNull();
        expect(syncMissionEpisodeMemory(directory, { ...state, lastContinuationReason: "cancelled" }, [])).toBeNull();
        expect(readdirSync(directory)).toEqual([]);
    });
});
