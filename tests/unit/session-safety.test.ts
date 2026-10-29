/**
 * Safety hooks run in every session.
 *
 * Subagents run in child sessions that never own a mission, so the role guard
 * and the secret scanner must not depend on a session entry or an active
 * mission. Mission bookkeeping (step footer, evidence, resource control) stays
 * with the session that owns the active mission.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeHooks } from "../../src/hooks/index";
import { ResourceControlHook } from "../../src/hooks/custom/resource-control";
import { createToolExecuteBeforeHandler } from "../../src/plugin-handlers/tool-execute-pre-handler";
import { createToolExecuteAfterHandler } from "../../src/plugin-handlers/tool-execute-handler";
import { clearEvidence, getUnverifiedFiles } from "../../src/core/loop/evidence";
import { MISSION_MESSAGES } from "../../src/shared/constants/system-messages";
import type { PluginSessionState, ToolExecuteHandlerContext } from "../../src/plugin-handlers/context";

vi.mock("../../src/shared/logger", () => ({ log: vi.fn() }));

const FORK_BOMB = ":(){ :|:& };:";
const GITHUB_TOKEN = `ghp_${"a".repeat(36)}`;

function missionSession(active: boolean): PluginSessionState {
    return { active, step: 0, startTime: Date.now(), lastStepTime: Date.now(), tokens: { totalInput: 0, totalOutput: 0 } };
}

function context(sessions: Map<string, PluginSessionState> = new Map()): ToolExecuteHandlerContext {
    return { client: {} as never, directory: "/tmp/project", sessions };
}

function toolOutput(text: string) {
    return { title: "shell", output: text, metadata: {} };
}

beforeAll(() => {
    // The production wiring, not a hand-built registry.
    initializeHooks();
});

describe("pre-tool safety in every session", () => {
    it("blocks a fork bomb sent to the shell tool in a session with no entry", async () => {
        await expect(createToolExecuteBeforeHandler(context())(
            { tool: "shell", sessionID: "subagent-child", callID: "c1" },
            { args: { command: FORK_BOMB } },
        )).rejects.toThrow(/Action Blocked/);
    });

    it("blocks a fork bomb in a session whose mission is inactive", async () => {
        const sessions = new Map([["paused", missionSession(false)]]);
        await expect(createToolExecuteBeforeHandler(context(sessions))(
            { tool: "shell", sessionID: "paused", callID: "c1" },
            { args: { command: FORK_BOMB } },
        )).rejects.toThrow(/Action Blocked/);
    });

    it("blocks root deletion in a session with no entry", async () => {
        await expect(createToolExecuteBeforeHandler(context())(
            { tool: "shell", sessionID: "subagent-child", callID: "c1" },
            { args: { command: "rm -rf /" } },
        )).rejects.toThrow(/Action Blocked/);
    });

    it("allows ordinary shell commands in a session with no entry", async () => {
        await expect(createToolExecuteBeforeHandler(context())(
            { tool: "shell", sessionID: "subagent-child", callID: "c1" },
            { args: { command: "ls -la" } },
        )).resolves.toBeUndefined();
    });
});

describe("post-tool safety in every session", () => {
    const resourceSpy = vi.spyOn(ResourceControlHook.prototype, "execute");

    beforeEach(() => {
        resourceSpy.mockClear();
        for (const id of ["subagent-child", "paused", "owner"]) clearEvidence(id);
    });
    afterEach(() => {
        for (const id of ["subagent-child", "paused", "owner"]) clearEvidence(id);
    });

    it("redacts a secret without a session entry, but adds no footer and records no evidence", async () => {
        const output = toolOutput(`token=${GITHUB_TOKEN}`);
        const after = createToolExecuteAfterHandler(context(), true);

        await after({ tool: "write", sessionID: "subagent-child", callID: "c1", args: { filePath: "src/a.ts" } }, output);

        expect(output.output).toBe(`token=${MISSION_MESSAGES.SECRET_REDACTED_MSG}`);
        expect(output.output).not.toContain(GITHUB_TOKEN);
        expect(output.output).not.toMatch(/Step \d+/);
        expect(getUnverifiedFiles("subagent-child")).toEqual([]);
        expect(resourceSpy).not.toHaveBeenCalled();
    });

    it("redacts a secret in a session whose mission is inactive without counting a step", async () => {
        const session = missionSession(false);
        const output = toolOutput(`key ${GITHUB_TOKEN}`);
        const after = createToolExecuteAfterHandler(context(new Map([["paused", session]])), true);

        await after({ tool: "edit", sessionID: "paused", callID: "c1", args: { filePath: "src/b.ts" } }, output);

        expect(output.output).not.toContain(GITHUB_TOKEN);
        expect(output.output).toContain(MISSION_MESSAGES.SECRET_REDACTED_MSG);
        expect(output.output).not.toMatch(/Step \d+/);
        expect(session.step).toBe(0);
        expect(getUnverifiedFiles("paused")).toEqual([]);
        expect(resourceSpy).not.toHaveBeenCalled();
    });

    it("keeps the footer, step count and evidence for the active mission session", async () => {
        const session = missionSession(true);
        const output = toolOutput(`key ${GITHUB_TOKEN}`);
        const after = createToolExecuteAfterHandler(context(new Map([["owner", session]])), true);

        await after({ tool: "write", sessionID: "owner", callID: "c1", args: { filePath: "src/c.ts" } }, output);

        expect(output.output).not.toContain(GITHUB_TOKEN);
        expect(output.output).toMatch(/Step 1 \|/);
        expect(session.step).toBe(1);
        expect(getUnverifiedFiles("owner")).toEqual(["src/c.ts"]);
        expect(resourceSpy).toHaveBeenCalledOnce();
    });
});
