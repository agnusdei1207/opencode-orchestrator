/**
 * End-to-end regression guard for issues #35, #37 and #38.
 *
 * Runs the built `dist/index.js` bundle — the artifact users actually install —
 * against a fake OpenCode client, driving the event sequence that produced the
 * bug reports: an active mission, a turn that makes several tool calls (so the
 * run loop completes an assistant message per step, mid-turn), and only then a
 * real idle.
 *
 * Against v1.7.10 this scenario produced four mid-turn injections, ten
 * non-synthetic text parts and a spurious "STAGNATION DETECTED". Those are the
 * exact symptoms in the reports, so this test is the thing that proves the fix
 * rather than restating it.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const DIST_ENTRY = join(process.cwd(), "dist", "index.js");
const SESSION = "ses_e2e_injection";
const STEP_COUNT = 4;

interface SentPrompt {
    busyAtSendTime: boolean;
    parts: Array<{ type: string; text?: string; synthetic?: boolean }>;
}

/** Long, perfectly healthy prose — the shape that used to trip issue #35. */
const LONG_HEALTHY_OUTPUT = (
    "The orchestrator coordinates multi-agent workflows with autonomous verification "
    + "and local-first memory, delegating file-level work to isolated workers. "
).repeat(40);

function seedMissionWorkspace(): string {
    const workspace = join(tmpdir(), `oco-e2e-injection-${process.pid}`);
    const opencodeDir = join(workspace, ".opencode");

    rmSync(workspace, { recursive: true, force: true });
    mkdirSync(opencodeDir, { recursive: true });

    // Unfinished work is what makes the loop want to inject at all.
    writeFileSync(join(opencodeDir, "todo.md"), "# TODO\n\n- [ ] Implement the feature\n- [ ] Add tests\n");
    writeFileSync(
        join(opencodeDir, "verification-checklist.md"),
        "# Verification\n\n## Build\n- [ ] Build passes\n\n## Unit Tests\n- [ ] Tests pass\n",
    );
    writeFileSync(join(opencodeDir, "mission-loop.json"), JSON.stringify({
        active: true,
        iteration: 1,
        maxIterations: 50,
        prompt: "Implement the feature",
        objective: "Implement the feature",
        sessionID: SESSION,
        startedAt: new Date().toISOString(),
    }));

    return workspace;
}

function settle(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("session injection regression (issues #35, #37, #38)", () => {
    const sent: SentPrompt[] = [];
    let serverBusy = false;

    beforeAll(async () => {
        // Requires a build; dist-integrity.test.ts covers the bundle's presence.
        if (!existsSync(DIST_ENTRY)) return;

        const workspace = seedMissionWorkspace();
        const client = {
            session: {
                prompt: async ({ path, body }: any) => {
                    sent.push({ busyAtSendTime: serverBusy, parts: body.parts });
                    expect(path.id).toBe(SESSION);
                    return { data: {} };
                },
                // Upstream lists ONLY non-idle sessions in this map.
                status: async () => ({ data: serverBusy ? { [SESSION]: { type: "busy" } } : {} }),
                message: async () => ({ data: { parts: [{ type: "text", text: LONG_HEALTHY_OUTPUT }] } }),
                todo: async () => ({
                    data: [{ id: "T1", content: "Implement the feature", status: "pending", priority: "high" }],
                }),
                get: async () => ({ data: { id: SESSION } }),
            },
            tui: { showToast: async () => ({ data: true }) },
            app: { log: async () => ({ data: true }) },
        };

        const { default: plugin } = await import(pathToFileURL(DIST_ENTRY).href);
        const hooks = await plugin({ directory: workspace, client, worktree: workspace, $: () => {} }, {});
        const fire = (event: unknown) => hooks.event?.({ event });

        await fire({ type: "session.created", properties: { info: { id: SESSION } } });
        await hooks["chat.message"]?.(
            { sessionID: SESSION },
            {
                message: { sessionID: SESSION, role: "user" },
                parts: [{ type: "text", text: "/task Implement the feature" }],
            },
        );

        // The turn starts and stays busy across several tool-calling steps.
        serverBusy = true;
        await fire({ type: "session.status", properties: { sessionID: SESSION, status: { type: "busy" } } });

        for (let step = 1; step <= STEP_COUNT; step++) {
            await fire({
                type: "message.updated",
                properties: {
                    info: {
                        id: `msg_step_${step}`,
                        sessionID: SESSION,
                        role: "assistant",
                        time: { created: Date.now(), completed: Date.now() },
                        tokens: { input: 1000, output: 200, reasoning: 0 },
                    },
                },
            });
            await settle(120);
        }
        await settle(400);

        // Only now does the turn actually end.
        serverBusy = false;
        await fire({ type: "session.status", properties: { sessionID: SESSION, status: { type: "idle" } } });
        await fire({ type: "session.idle", properties: { sessionID: SESSION } });
        await settle(1500);
    }, 60_000);

    it("never injects while the session is still working", () => {
        const midTurn = sent.filter(entry => entry.busyAtSendTime);
        const texts = midTurn.map(entry => entry.parts?.[0]?.text?.slice(0, 80));

        expect(midTurn.length, `injected mid-turn: ${JSON.stringify(texts)}`).toBe(0);
    });

    it("still delivers the continuation once the session goes idle", () => {
        // The guard must hold prompts back, not silently kill the mission loop.
        expect(sent.filter(entry => !entry.busyAtSendTime).length).toBeGreaterThan(0);
    });

    it("flags every injected part synthetic so the TUI does not show it as user input", () => {
        const plainParts = sent
            .flatMap(entry => entry.parts ?? [])
            .filter(part => part.type === "text" && part.synthetic !== true);

        expect(plainParts.map(part => part.text?.slice(0, 60))).toEqual([]);
    });

    it("raises no output anomaly for long healthy assistant output", () => {
        const anomalies = sent
            .flatMap(entry => entry.parts ?? [])
            .filter(part => part.text?.includes("ANOMALY"));

        expect(anomalies.map(part => part.text?.slice(0, 80))).toEqual([]);
    });
});
