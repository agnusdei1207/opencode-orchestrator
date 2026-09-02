/**
 * Stagnation guard (issue #39)
 *
 * A model that answers three idle re-prompts with the same text and no tool
 * call is stuck — the reported case was a Commander echoing DCP's
 * `<dcp-system-reminder>` instead of calling `compress`. The guard opens the
 * circuit breaker from completed assistant turns, the todo continuation
 * honors it, and a real user message clears it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearCircuitState,
    detectRepetitiveOutput,
    getCircuitState,
    isCircuitOpen,
    recordAssistantTurn,
    recordToolCall,
    shouldTripCircuit,
    shutdownCircuitBreaker,
} from "../../src/core/loop/circuit-breaker";
import { handleCompletedAssistantMessage } from "../../src/plugin-handlers/assistant-done-handler";
import { createChatMessageHandler } from "../../src/plugin-handlers/chat-message-handler";
import { handleSessionIdle } from "../../src/core/loop/todo-continuation";
import { HookRegistry } from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";
import * as Toast from "../../src/core/notification/toast";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));
vi.mock("../../src/core/agents/manager", () => ({
    ParallelAgentManager: {
        getInstance: vi.fn(() => ({ getTasksByParent: () => [] })),
    },
}));
vi.mock("../../src/core/notification/toast", () => ({
    show: vi.fn(),
}));

const SESSION = "ses_stagnation";
const REMINDER = "<dcp-system-reminder>\nCRITICAL WARNING: MAX CONTEXT LIMIT REACHED\n</dcp-system-reminder>";

describe("circuit breaker: repeated output", () => {
    beforeEach(() => {
        clearCircuitState(SESSION);
        vi.useRealTimers();
    });

    afterEach(() => {
        clearCircuitState(SESSION);
        shutdownCircuitBreaker();
        vi.useRealTimers();
    });

    it("opens after three identical no-tool turns, ignoring whitespace differences", () => {
        recordAssistantTurn(SESSION, REMINDER, 0);
        recordAssistantTurn(SESSION, REMINDER.replace(/\n/g, "  \n "), 0);
        expect(detectRepetitiveOutput(SESSION)).toBe(false);
        expect(shouldTripCircuit(SESSION)).toBe(false);

        recordAssistantTurn(SESSION, `  ${REMINDER}  `, 0);
        expect(detectRepetitiveOutput(SESSION)).toBe(true);
        expect(shouldTripCircuit(SESSION)).toBe(true);
        expect(isCircuitOpen(SESSION)).toBe(true);
        expect(getCircuitState(SESSION)?.openedBy).toBe("output");
    });

    it("treats a turn that called a tool as progress", () => {
        recordAssistantTurn(SESSION, REMINDER, 0);
        recordAssistantTurn(SESSION, REMINDER, 0);
        recordAssistantTurn(SESSION, REMINDER, 1);
        recordAssistantTurn(SESSION, REMINDER, 0);
        recordAssistantTurn(SESSION, REMINDER, 0);

        expect(detectRepetitiveOutput(SESSION)).toBe(false);
        expect(shouldTripCircuit(SESSION)).toBe(false);
    });

    it("does not trip on three different answers", () => {
        recordAssistantTurn(SESSION, "one", 0);
        recordAssistantTurn(SESSION, "two", 0);
        recordAssistantTurn(SESSION, "three", 0);

        expect(shouldTripCircuit(SESSION)).toBe(false);
    });

    it("ignores empty turns so aborted/rate-limited turns never open the output circuit", () => {
        // readAssistantTurn returns text:"" for aborted, rate-limited, or
        // failed-to-read turns; three of them must not look like a repeat.
        recordAssistantTurn(SESSION, "", 0);
        recordAssistantTurn(SESSION, "   \n  ", 0);
        recordAssistantTurn(SESSION, "", 0);

        expect(detectRepetitiveOutput(SESSION)).toBe(false);
        expect(shouldTripCircuit(SESSION)).toBe(false);
    });

    it("stays open much longer than a tool-loop trip", () => {
        vi.useFakeTimers();
        for (let i = 0; i < 3; i++) recordAssistantTurn(SESSION, REMINDER, 0);
        expect(shouldTripCircuit(SESSION)).toBe(true);

        vi.advanceTimersByTime(31_000);
        expect(isCircuitOpen(SESSION)).toBe(true);

        vi.advanceTimersByTime(10 * 60_000);
        expect(isCircuitOpen(SESSION)).toBe(false);
        expect(getCircuitState(SESSION)?.idleTurnHistory).toEqual([]);
    });

    it("keeps the short reset for a tool-repetition trip", () => {
        vi.useFakeTimers();
        for (let i = 0; i < 3; i++) recordToolCall(SESSION, "read");
        expect(shouldTripCircuit(SESSION)).toBe(true);
        expect(getCircuitState(SESSION)?.openedBy).toBe("tool");

        vi.advanceTimersByTime(31_000);
        expect(isCircuitOpen(SESSION)).toBe(false);
    });
});

describe("assistant-done handler feeds the guard", () => {
    const executeDone = vi.fn();

    beforeEach(() => {
        clearCircuitState(SESSION);
        vi.spyOn(HookRegistry, "getInstance").mockReturnValue({ executeDone } as unknown as HookRegistry);
        executeDone.mockResolvedValue({ action: "continue", prompts: [] });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearCircuitState(SESSION);
    });

    function contextWith(parts: Array<{ type: string; text?: string }>) {
        return {
            client: { session: { message: vi.fn().mockResolvedValue({ data: { parts } }) } },
            directory: "/tmp/test",
            sessions: new Map([[SESSION, {
                active: true, step: 0, timestamp: 0, startTime: 0, lastStepTime: 0,
                tokens: { totalInput: 0, totalOutput: 0, estimatedCost: 0 },
            }]]),
        } as never;
    }

    it("records text-only turns and counts tool parts as progress", async () => {
        const echo = contextWith([{ type: "text", text: REMINDER }]);
        await handleCompletedAssistantMessage(echo, SESSION, "m1");
        await handleCompletedAssistantMessage(echo, SESSION, "m2");
        expect(getCircuitState(SESSION)?.idleTurnHistory).toHaveLength(2);

        const acted = contextWith([{ type: "text", text: REMINDER }, { type: "tool" }]);
        await handleCompletedAssistantMessage(acted, SESSION, "m3");
        expect(getCircuitState(SESSION)?.idleTurnHistory).toEqual([]);
    });
});

describe("todo continuation honors the guard", () => {
    beforeEach(() => {
        clearCircuitState(SESSION);
        vi.mocked(Toast.show).mockClear();
    });

    afterEach(() => {
        clearCircuitState(SESSION);
    });

    it("pauses instead of re-prompting a model that keeps repeating itself, and tells the user", async () => {
        for (let i = 0; i < 3; i++) recordAssistantTurn(SESSION, REMINDER, 0);
        const todo = vi.fn().mockResolvedValue({ data: [] });

        await handleSessionIdle({ session: { todo } } as never, "/tmp/test", SESSION, SESSION);

        expect(todo).not.toHaveBeenCalled();
        expect(isCircuitOpen(SESSION)).toBe(true);
        expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ variant: "warning" }));
    });

    it("does NOT pause continuation for ordinary tool repetition (three reads in a row)", async () => {
        // A normal turn ending in the same tool three times is real work, not a
        // stuck output loop — the continuation must still run.
        for (let i = 0; i < 3; i++) recordToolCall(SESSION, "read");
        const todo = vi.fn().mockResolvedValue({ data: [] });

        await handleSessionIdle({ session: { todo } } as never, "/tmp/test", SESSION, SESSION);

        expect(todo).toHaveBeenCalled();
        expect(Toast.show).not.toHaveBeenCalled();
    });
});

describe("a real user message resets the guard", () => {
    beforeEach(() => {
        clearCircuitState(SESSION);
        vi.spyOn(HookRegistry.getInstance(), "executeChat").mockResolvedValue({ action: HOOK_ACTIONS.PROCESS });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearCircuitState(SESSION);
    });

    function tripped() {
        for (let i = 0; i < 3; i++) recordAssistantTurn(SESSION, REMINDER, 0);
        expect(shouldTripCircuit(SESSION)).toBe(true);
    }

    it("clears the circuit for a message the user typed", async () => {
        tripped();
        const handler = createChatMessageHandler({ client: {} as never, directory: "/tmp/test", sessions: new Map() });

        await handler({ sessionID: SESSION } as never, { parts: [{ type: "text", text: "try compress again" }] } as never);

        expect(getCircuitState(SESSION)).toBeUndefined();
    });

    it("leaves the circuit open for the orchestrator's own synthetic prompts", async () => {
        tripped();
        const handler = createChatMessageHandler({ client: {} as never, directory: "/tmp/test", sessions: new Map() });

        await handler(
            { sessionID: SESSION } as never,
            { parts: [{ type: "text", text: "[CONTINUE] mission not complete", synthetic: true }] } as never,
        );

        expect(isCircuitOpen(SESSION)).toBe(true);
    });
});
