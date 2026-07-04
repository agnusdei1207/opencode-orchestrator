/**
 * Plumbing / Wiring Guards
 *
 * Structural + behavioral invariants over cross-module data flow that
 * type-checking and snapshots don't catch. Each test here encodes a wiring
 * defect found in the round-2 plumbing audit:
 *
 *  - 4a: HookContext.agent was declared but never populated by any of the
 *        four plugin handlers, so MemoryGateHook recorded every mission
 *        memory as literally "Agent [undefined]".
 *  - 4b: shutdownCircuitBreaker() / shutdownCompactionGuard() existed to
 *        clear module-load timers + state, but were never registered with
 *        the ShutdownManager, leaking on plugin dispose/hot-reload.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { MemoryGateHook } from "../../src/hooks/custom/memory-gate.js";
import { MemoryManager, MemoryLevel } from "../../src/core/memory/memory-manager.js";
import type { HookContext } from "../../src/hooks/registry.js";

const SRC = (rel: string) => fileURLToPath(new URL(`../../src/${rel}`, import.meta.url));

function ctx(agent?: string): HookContext {
    return { sessionID: "s1", agent, directory: "/tmp", sessions: new Map() };
}

describe("Plumbing / Wiring Guards", () => {
    beforeEach(() => {
        // Reset the memory singleton so each test reads only its own writes.
        // @ts-expect-error - test-only reset of the singleton
        MemoryManager.instance = undefined;
    });

    // ---- 4a: agent flows into recorded memory --------------------------------

    it("records the acting agent in mission memory (never literal 'undefined')", async () => {
        const hook = new MemoryGateHook();
        await hook.execute(ctx("commander"), "Mission DONE: shipped the feature");

        const mission = MemoryManager.getInstance().export()[MemoryLevel.MISSION];
        const summary = mission.map((m) => m.content).join("\n");
        expect(summary).toContain("commander");
        expect(summary, "agent name leaked as the literal string 'undefined'").not.toContain(
            "[undefined]",
        );
    });

    it("degrades to a readable placeholder when agent is genuinely unknown", async () => {
        const hook = new MemoryGateHook();
        await hook.execute(ctx(undefined), "Task DONE with SUCCESS");

        const mission = MemoryManager.getInstance().export()[MemoryLevel.MISSION];
        const summary = mission.map((m) => m.content).join("\n");
        expect(summary).not.toContain("[undefined]");
    });

    it("every plugin handler populates HookContext.agent when it builds one", () => {
        // The four handlers that construct a HookContext must include an
        // `agent` field, otherwise downstream hooks (memory-gate, role-guard)
        // receive undefined regardless of what the session knows.
        const handlers = [
            "plugin-handlers/chat-message-handler.ts",
            "plugin-handlers/assistant-done-handler.ts",
            "plugin-handlers/tool-execute-pre-handler.ts",
            "plugin-handlers/tool-execute-handler.ts",
        ];
        for (const rel of handlers) {
            const src = readFileSync(SRC(rel), "utf8");
            // Only assert on files that actually execute an internal hook phase.
            if (!/hooks\.(execute(Chat|Done|PreTool|PostTool))/.test(src)) continue;
            expect(src, `${rel}: HookContext built without an agent field`).toMatch(
                /agent[:,]/,
            );
        }
    });

    // ---- 4b: shutdown functions are wired to the ShutdownManager -------------

    it("registers the circuit-breaker and compaction-guard shutdowns on dispose", () => {
        const index = readFileSync(SRC("index.ts"), "utf8");
        expect(index, "shutdownCircuitBreaker never registered → timer leak on dispose").toContain(
            "shutdownCircuitBreaker",
        );
        expect(index, "shutdownCompactionGuard never registered → timer leak on dispose").toContain(
            "shutdownCompactionGuard",
        );
    });
});
