import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { readLoopState, writeLoopState } from "../../src/core/loop/mission-loop";
import type { MissionLoopState } from "../../src/shared/loop/types";

vi.mock("node:fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:fs")>();
    return { ...actual, writeFileSync: vi.fn(actual.writeFileSync), renameSync: vi.fn(actual.renameSync) };
});
vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("mission loop state persistence", () => {
    let directory: string;
    const state: MissionLoopState = {
        active: true,
        iteration: 1,
        maxIterations: 10,
        prompt: "Finish the requested scope",
        sessionID: "state-owner",
        startedAt: new Date().toISOString(),
    };

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "mission-state-"));
        vi.mocked(fs.writeFileSync).mockClear();
        vi.mocked(fs.renameSync).mockClear();
    });
    afterEach(() => rmSync(directory, { recursive: true, force: true }));

    it("replaces the state file atomically through a unique temporary file", () => {
        expect(writeLoopState(directory, state)).toBe(true);
        expect(writeLoopState(directory, { ...state, iteration: 2 })).toBe(true);

        const renames = vi.mocked(fs.renameSync).mock.calls.map(([from, to]) => [String(from), String(to)]);
        expect(renames).toHaveLength(2);
        const [first, second] = renames;
        // A crash mid-write must leave either the old or the new file, never a torn one.
        expect(first[1]).toBe(second[1]);
        expect(dirname(first[0])).toBe(dirname(first[1]));
        expect(first[0]).not.toBe(second[0]);
        const directWrites = vi.mocked(fs.writeFileSync).mock.calls.filter(([path]) => String(path) === first[1]);
        expect(directWrites).toHaveLength(0);
        expect(readLoopState(directory)?.iteration).toBe(2);
        expect(fs.readdirSync(dirname(first[1])).filter(name => name.endsWith(".tmp"))).toEqual([]);
    });
});
