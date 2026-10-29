/**
 * Plumbing / Wiring Guards
 *
 * Structural + behavioral invariants over cross-module data flow that
 * type-checking and snapshots don't catch. Each test here encodes a wiring
 * defect found in the round-2 plumbing audit:
 *
 *  - 4a: HookContext.agent was declared but never populated by any of the
 *        four plugin handlers, so agent-aware hooks saw undefined.
 *  - 4b: modules that start a prune timer at import time own an interval
 *        and per-session state, and leaked both on dispose because their
 *        shutdown was never registered with the ShutdownManager.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";


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

describe("Plumbing / Wiring Guards", () => {
    // ---- 4a: agent flows into hook context -----------------------------------

    it("every plugin handler populates HookContext.agent when it builds one", () => {
        // The four handlers that construct a HookContext must include an
        // `agent` field, otherwise downstream hooks
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
        // and per-session state, and leaks both on
        // dispose or hot-reload unless its shutdown is registered. A factory hands
        // that obligation to whoever holds the instance, so the owner is checked.
        const lifecycleSource = ["index.ts", "plugin-runtime.ts"]
            .map(rel => readFileSync(SRC(rel), "utf8"))
            .join("\n");
        const owners = globSourceFiles().filter(rel => {
            const src = readFileSync(SRC(rel), "utf8");
            return /pruneTimer\.start\(\)/.test(src)
                || /^const \w+ = createSessionStateStore\(\)/m.test(src);
        });

        expect(owners.length, "no prune-timer modules found; is the scan working?")
            .toBeGreaterThan(0);

        for (const rel of owners) {
            const src = readFileSync(SRC(rel), "utf8");
            // A factory publishes `shutdown` on its returned interface or class;
            // its consumer is the lifecycle owner checked by this same scan.
            const factoryOwnsCleanup = /\bcreate[A-Z]\w*\b/.test(src)
                && (/^\s*shutdown,\s*$/m.test(src)
                    || (/implements SessionStateStore/.test(src)
                        && /shutdown\(\): void/.test(src)));
            if (factoryOwnsCleanup) continue;

            const shutdownName = src.match(/export function (shutdown\w+)\s*\(/)?.[1];
            expect(shutdownName, `${rel}: owns a prune timer but exports no shutdown`)
                .toBeTruthy();

            // Must be *called* from a shutdownManager.register(...), not merely
            // imported: an unused import satisfies a substring check while the
            // timer still leaks.
            const registered = new RegExp(
                `shutdownManager\\.register\\([^;]*\\b${shutdownName}(?:\\(\\))?`,
            ).test(lifecycleSource);
            expect(registered, `${rel}: ${shutdownName} never registered; timer leak on dispose`)
                .toBe(true);
        }
    });

    // ---- 5b: continuations never interrupt a working session (issue #38) -----

    it("guards every continuation injection with a live busy check", () => {
        // POST /session/{id}/prompt writes the user message before it checks
        // whether the session is already running, so an unguarded injection
        // lands inside the turn the model is still executing.
        for (const rel of ["core/loop/mission-loop-handler.ts"]) {
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
            /client\.prompt\(/,
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
        // Enumerated from `grep -rn "client.prompt("` so a new injection site
        // cannot be added without either a guard or a deliberate exemption.
        // `noReply: true` does NOT make a write safe: upstream still persists
        // the user message and only skips starting a new run.
        const guarded = [
            "core/loop/mission-loop-handler.ts",
            "core/recovery/session-recovery.ts",
            "core/session/pending-injection.ts",
        ];
        for (const rel of guarded) {
            expect(readFileSync(SRC(rel), "utf8"), `${rel}: writes to a session without a busy check`)
                .toMatch(/isSessionBusy\(/);
        }

        // No other module may write to a session behind the guard list's back.
        const writers = globSourceFiles()
            .filter(rel => rel !== "host/client.ts")
            .filter(rel => /client\.prompt\(/.test(readFileSync(SRC(rel), "utf8")));
        expect(writers.sort()).toEqual([...guarded].sort());
    });

    it("feeds session.status transitions into the activity tracker", () => {
        const src = readFileSync(SRC("plugin-handlers/event-handler.ts"), "utf8");

        expect(src, "session.status never reaches the activity tracker").toMatch(
            /SessionActivity\.recordSessionStatus\(/,
        );
        expect(src, "a busy transition never cancels the mission countdown").toMatch(
            /MissionLoopHandler\.handleSessionBusy\(/,
        );
    });

    it("releases child-session tracking when the plugin instance is disposed", () => {
        const src = readFileSync(SRC("plugin-runtime.ts"), "utf8");
        expect(src).toMatch(/shutdownManager\.register\(SHUTDOWN_HANDLERS\.CHILD_SESSIONS,\s*\(\)\s*=>\s*children\.clear\(\)/);
        expect(src).toMatch(/SHUTDOWN_HANDLERS\.PROCESS_SERVICES,[\s\S]{0,80}PROCESS_SHUTDOWN_TIMEOUT_MS/);
    });
});
