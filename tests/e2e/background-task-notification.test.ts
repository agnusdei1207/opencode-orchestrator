/**
 * End-to-end guard for the background-task notification path (issue #38).
 *
 * When a background subagent finishes, the orchestrator tells the parent agent
 * about it. The parent is very often mid-turn at that moment — spawning work and
 * continuing to think is the whole point of a background task.
 *
 * `noReply: true` does not make that write safe. Upstream `SessionPrompt.prompt`
 * persists the user message and only then decides whether to start a run
 * (`if (input.noReply === true) return message`), so the text still lands inside
 * the turn the model is executing.
 *
 * This drives the real path through the built bundle: launch a background task
 * with the `delegate_task` tool, let its session go idle, and watch what reaches
 * the parent. It lives in its own file because ParallelAgentManager is a
 * singleton — sharing a module registry with another suite would hand it a
 * different client than the one under test.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const DIST_ENTRY = join(process.cwd(), "dist", "index.js");
const PARENT = "ses_parent_bg";
const CHILD = "ses_child_bg";
/** CONFIG.MIN_STABILITY_MS is 2s; a task younger than that is not "done" yet. */
const STABILITY_WAIT_MS = 2_600;

interface SentPrompt {
    sessionID: string;
    busyAtSendTime: boolean;
    text: string;
    synthetic?: boolean;
}

function settle(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

describe("background task notification never interrupts a working parent (issue #38)", () => {
    const sent: SentPrompt[] = [];
    let parentBusy = false;
    let launched = false;

    beforeAll(async () => {
        if (!existsSync(DIST_ENTRY)) return;

        const workspace = join(tmpdir(), `oco-e2e-bgnotify-${process.pid}`);
        rmSync(workspace, { recursive: true, force: true });
        mkdirSync(join(workspace, ".opencode"), { recursive: true });

        const client = {
            session: {
                create: async () => ({ data: { id: CHILD } }),
                delete: async () => ({ data: true }),
                prompt: async ({ path, body }: any) => {
                    sent.push({
                        sessionID: path.id,
                        busyAtSendTime: path.id === PARENT ? parentBusy : false,
                        text: body.parts?.[0]?.text ?? "",
                        synthetic: body.parts?.[0]?.synthetic,
                    });
                    return { data: {} };
                },
                // Only the parent is ever reported busy; the child has finished.
                status: async () => ({ data: parentBusy ? { [PARENT]: { type: "busy" } } : {} }),
                // The subagent produced real output, so its idle counts as done.
                messages: async () => ({
                    data: [{
                        info: { role: "assistant", time: { completed: Date.now() } },
                        parts: [{ type: "text", text: "Implemented the change and ran the tests." }],
                    }],
                }),
                message: async () => ({
                    data: { parts: [{ type: "text", text: "Implemented the change and ran the tests." }] },
                }),
                todo: async () => ({ data: [] }),
                get: async () => ({ data: { id: PARENT } }),
            },
            tui: { showToast: async () => ({ data: true }) },
            app: { log: async () => ({ data: true }) },
        };

        const { default: plugin } = await import(pathToFileURL(DIST_ENTRY).href);
        const hooks = await plugin({ directory: workspace, client, worktree: workspace, $: () => {} }, {});
        const fire = (event: unknown) => hooks.event?.({ event });

        await fire({ type: "session.created", properties: { info: { id: PARENT } } });
        await hooks["chat.message"]?.(
            { sessionID: PARENT },
            { message: { sessionID: PARENT, role: "user" }, parts: [{ type: "text", text: "build the feature" }] },
        );

        const delegate = hooks.tool?.delegate_task;
        if (!delegate) return;

        await delegate.execute(
            {
                agent: "worker",
                description: "background unit",
                prompt: "implement the change",
                background: true,
            },
            { sessionID: PARENT, agent: "commander" },
        );
        launched = true;

        // The parent keeps working while its background task runs — the exact
        // situation the old code interrupted.
        parentBusy = true;
        await settle(STABILITY_WAIT_MS);

        // The subagent finishes.
        await fire({ type: "session.idle", properties: { sessionID: CHILD } });
        await settle(600);

        // The parent's own turn finally ends. The deferred notice must arrive
        // now — holding it back must not mean losing it.
        parentBusy = false;
        await fire({ type: "session.status", properties: { sessionID: PARENT, status: { type: "idle" } } });
        await fire({ type: "session.idle", properties: { sessionID: PARENT } });
        await settle(1200);
    }, 60_000);

    it("launches the background task through the real tool", () => {
        expect(launched, "delegate_task did not run — the rest of this suite proves nothing").toBe(true);
    });

    it("sends nothing to the parent while it is still working", () => {
        const toBusyParent = sent.filter(entry => entry.sessionID === PARENT && entry.busyAtSendTime);
        const texts = toBusyParent.map(entry => entry.text.slice(0, 80));

        expect(toBusyParent.length, `interrupted the parent mid-turn: ${JSON.stringify(texts)}`).toBe(0);
    });

    it("still delivers the completion notice once the parent goes idle", () => {
        // Without this the suite would pass vacuously: a notification that never
        // fires at all also never interrupts anything.
        const delivered = sent.filter(entry => entry.sessionID === PARENT && !entry.busyAtSendTime);

        expect(delivered.length, "the background-task notice was dropped, not deferred")
            .toBeGreaterThan(0);
        expect(delivered.some(entry => entry.text.includes("BACKGROUND")), 
            `no task notice among: ${JSON.stringify(delivered.map(e => e.text.slice(0, 60)))}`).toBe(true);
    });

    it("marks anything it does send to the parent as synthetic", () => {
        const plain = sent.filter(entry => entry.sessionID === PARENT && entry.synthetic !== true);

        expect(plain.map(entry => entry.text.slice(0, 60))).toEqual([]);
    });
});
