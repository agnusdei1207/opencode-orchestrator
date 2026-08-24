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
 *  - 4b: modules that start a prune timer at import time own an interval
 *        and per-session state, and leaked both on dispose because their
 *        shutdown was never registered with the ShutdownManager.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { MemoryGateHook } from "../../src/hooks/custom/memory-gate.js";
import { MemoryManager, MemoryLevel } from "../../src/core/memory/memory-manager.js";
import type { HookContext } from "../../src/hooks/registry.js";

const SRC = (rel: string) => fileURLToPath(new URL(`../../src/${rel}`, import.meta.url));
const SRC_ROOT = fileURLToPath(new URL("../../src/", import.meta.url));

/** Every .ts file under src/, as paths relative to src/. */
function globSourceFiles(dir = SRC_ROOT, prefix = ""): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) return globSourceFiles(join(dir, entry.name), rel);
        return entry.name.endsWith(".ts") ? [rel] : [];
    });
}

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

    // ---- 4b: prune timers are shut down on dispose ----------------------

    it("shuts down every module that starts a prune timer", () => {
        // Any module calling pruneTimer.start() owns a process-level interval
        // owns a process-level interval and per-session state, and leaks both on
        // dispose or hot-reload unless its shutdown is registered. A factory hands
        // that obligation to whoever holds the instance, so the owner is checked.
        const index = readFileSync(SRC("index.ts"), "utf8");
        const owners = globSourceFiles().filter(rel => {
            const src = readFileSync(SRC(rel), "utf8");
            return /pruneTimer\.start\(\)/.test(src)
                || /^const \w+ = createSessionStateStore\(\)/m.test(src);
        });

        expect(owners.length, "no prune-timer modules found — is the scan working?")
            .toBeGreaterThan(0);

        for (const rel of owners) {
            const src = readFileSync(SRC(rel), "utf8");
            // A factory only publishes `shutdown` on its returned interface; its own
            // file is not the owner, and is covered through the holder instead.
            if (/\bcreate[A-Z]\w*\b/.test(src) && /^\s*shutdown,\s*$/m.test(src)) continue;

            const shutdownName = src.match(/export function (shutdown\w+)\s*\(/)?.[1];
            expect(shutdownName, `${rel}: owns a prune timer but exports no shutdown`)
                .toBeTruthy();

            // Must be *called* from a shutdownManager.register(...), not merely
            // imported — an unused import satisfies a substring check while the
            // timer still leaks.
            const registered = new RegExp(
                `shutdownManager\\.register\\([^;]*\\b${shutdownName}\\(\\)`,
            ).test(index);
            expect(registered, `${rel}: ${shutdownName} never registered → timer leak on dispose`)
                .toBe(true);
        }
    });

    // ---- 5a: every session injection is flagged synthetic (issue #37) --------

    it("never injects a prompt into a user-facing session as a plain text part", () => {
        // A bare { type: "text", text } part renders in the TUI as if the user
        // typed it. Orchestrator-authored prompts must go through
        // syntheticTextPart/syntheticTextParts so OpenCode can hide them while
        // still passing them to the model.
        const injectionSites = [
            "core/loop/mission-loop-handler.ts",
            "core/loop/todo-continuation.ts",
            "core/recovery/session-recovery.ts",
            "core/agents/manager/task-cleaner.ts",
            "core/agents/manager/task-resumer.ts",
            "core/session/pending-injection.ts",
        ];

        for (const rel of injectionSites) {
            const src = readFileSync(SRC(rel), "utf8");
            expect(src, rel + ": injects a session prompt without the synthetic helper").toMatch(
                /syntheticTextParts?\(/,
            );
            expect(src, rel + ": still builds a raw text part for session.prompt").not.toMatch(
                /parts:\s*\[\s*\{\s*type:\s*PART_TYPES\.TEXT/,
            );
        }
    });

    // ---- 5b: continuations never interrupt a working session (issue #38) -----

    it("guards every continuation injection with a live busy check", () => {
        // POST /session/{id}/prompt writes the user message before it checks
        // whether the session is already running, so an unguarded injection
        // lands inside the turn the model is still executing.
        for (const rel of ["core/loop/mission-loop-handler.ts", "core/loop/todo-continuation.ts"]) {
            const src = readFileSync(SRC(rel), "utf8");
            expect(src, rel + ": no authoritative busy check before injecting").toMatch(
                /await isSessionBusy\(/,
            );
            expect(src, rel + ": no fast busy check before scheduling a countdown").toMatch(
                /isKnownBusy\(/,
            );
            expect(src, rel + ": no handler to drop a countdown when work resumes").toMatch(
                /handleSessionBusy/,
            );
        }
    });

    it("defers done-hook prompts to the next idle boundary instead of sending them", () => {
        // A completed assistant message ends a step, not the turn: the upstream
        // run loop starts another step whenever the model asked for tool calls.
        // Sending straight from the done-handler put a "continue" prompt into
        // the session after every tool call.
        const doneHandler = readFileSync(SRC("plugin-handlers/assistant-done-handler.ts"), "utf8");
        expect(doneHandler, "done-hook prompts are not queued").toMatch(/queuePrompts\(/);
        expect(doneHandler, "done-handler still prompts the session directly").not.toMatch(
            /client\.session\.prompt\(/,
        );

        const eventHandler = readFileSync(SRC("plugin-handlers/event-handler.ts"), "utf8");
        expect(eventHandler, "queued prompts are never flushed at idle").toMatch(
            /PendingInjection\.flushPrompts\(/,
        );
        expect(eventHandler, "queued prompts survive an abort").toMatch(
            /PendingInjection\.clearPrompts\(/,
        );
    });

    it("guards every write to a user-facing session with a busy check", () => {
        // Enumerated from `grep -rn "session.prompt("` so a new injection site
        // cannot be added without either a guard or a deliberate exemption.
        // `noReply: true` does NOT make a write safe: upstream still persists
        // the user message and only skips starting a new run.
        const guarded = [
            "core/loop/mission-loop-handler.ts",
            "core/loop/todo-continuation.ts",
            "core/recovery/session-recovery.ts",
            "core/agents/manager/task-cleaner.ts",
            "core/agents/manager/task-resumer.ts",
            "core/session/pending-injection.ts",
        ];
        for (const rel of guarded) {
            expect(readFileSync(SRC(rel), "utf8"), `${rel}: writes to a session without a busy check`)
                .toMatch(/isSessionBusy\(/);
        }

        // Exempt by design: the launcher opens a BRAND NEW subagent session, whose
        // first message is that session's real instruction, not an injection.
        for (const rel of ["core/agents/manager/task-launcher.ts"]) {
            expect(readFileSync(SRC(rel), "utf8"), `${rel}: should target a subagent session, not the user's`)
                .toMatch(/parentSessionID|sessionID/);
        }
    });

    it("feeds session.status transitions into the activity tracker", () => {
        const src = readFileSync(SRC("plugin-handlers/event-handler.ts"), "utf8");

        expect(src, "session.status never reaches the activity tracker").toMatch(
            /SessionActivity\.recordSessionStatus\(/,
        );
        expect(src, "a busy transition never cancels pending countdowns").toMatch(
            /TodoContinuation\.handleSessionBusy\(/,
        );
        expect(src, "a busy transition never cancels the mission countdown").toMatch(
            /MissionLoopHandler\.handleSessionBusy\(/,
        );
    });
});
