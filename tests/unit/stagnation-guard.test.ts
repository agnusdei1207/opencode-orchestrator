/**
 * Stagnation guard (issue #39)
 *
 * A model that answers three idle re-prompts with the same text and no tool
 * call is stuck; the reported case was a Commander echoing DCP's
 * `<dcp-system-reminder>` instead of calling `compress`. The guard opens the
 * circuit breaker from completed assistant turns, mission continuation
 * honors it, and a real user message clears it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    clearCircuitState,
    detectRepetitiveOutput,
    getCircuitState,
    isCircuitOpen,
    recordAssistantTurn,
    shutdownCircuitBreaker,
    tripOutputCircuit,
} from "../../src/core/loop/circuit-breaker";
import { handleCompletedAssistantMessage } from "../../src/plugin-handlers/assistant-done-handler";
import { createChatMessageHandler } from "../../src/plugin-handlers/chat-message-handler";
import { HookRegistry } from "../../src/hooks/registry";
import { HOOK_ACTIONS } from "../../src/hooks/constants";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));
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
        expect(tripOutputCircuit(SESSION)).toBe(false);

        recordAssistantTurn(SESSION, `  ${REMINDER}  `, 0);
        expect(detectRepetitiveOutput(SESSION)).toBe(true);
        expect(tripOutputCircuit(SESSION)).toBe(true);
        expect(isCircuitOpen(SESSION)).toBe(true);
    });

    it("treats a turn that called a tool as progress", () => {
        recordAssistantTurn(SESSION, REMINDER, 0);
        recordAssistantTurn(SESSION, REMINDER, 0);
        recordAssistantTurn(SESSION, REMINDER, 1);
        recordAssistantTurn(SESSION, REMINDER, 0);
        recordAssistantTurn(SESSION, REMINDER, 0);

        expect(detectRepetitiveOutput(SESSION)).toBe(false);
        expect(tripOutputCircuit(SESSION)).toBe(false);
    });

    it("does not trip on three different answers", () => {
        recordAssistantTurn(SESSION, "one", 0);
        recordAssistantTurn(SESSION, "two", 0);
        recordAssistantTurn(SESSION, "three", 0);

        expect(tripOutputCircuit(SESSION)).toBe(false);
    });

    it("ignores empty turns so aborted/rate-limited turns never open the output circuit", () => {
        // readAssistantTurn returns text:"" for aborted, rate-limited, or
        // failed-to-read turns; three of them must not look like a repeat.
        recordAssistantTurn(SESSION, "", 0);
        recordAssistantTurn(SESSION, "   \n  ", 0);
        recordAssistantTurn(SESSION, "", 0);

        expect(detectRepetitiveOutput(SESSION)).toBe(false);
        expect(tripOutputCircuit(SESSION)).toBe(false);
    });

    it("stays open for ten minutes so the user can intervene", () => {
        vi.useFakeTimers();
        for (let i = 0; i < 3; i++) recordAssistantTurn(SESSION, REMINDER, 0);
        expect(tripOutputCircuit(SESSION)).toBe(true);

        vi.advanceTimersByTime(31_000);
        expect(isCircuitOpen(SESSION)).toBe(true);

        vi.advanceTimersByTime(10 * 60_000);
        expect(isCircuitOpen(SESSION)).toBe(false);
        expect(getCircuitState(SESSION)?.idleTurnHistory).toEqual([]);
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
        expect(tripOutputCircuit(SESSION)).toBe(true);
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
