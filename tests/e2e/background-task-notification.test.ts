/**
 * End-to-end guard for the background-task notification path (issue #38).
 *
 * When a background subagent finishes, the orchestrator tells the parent agent
 * about it. The parent is very often mid-turn at that moment — spawning work and
 * continuing to think is the whole point of a background task.
 *
 * A no-reply write does not make that safe: the host still persists the
 * message, so the text lands inside the turn the model is executing.
 *
 * This drives the real path through the built bundle and a fake OpenCode 2
 * plugin context: launch a background task with the `delegate_task` tool, let
 * its session finish, and watch what reaches the parent while the parent is
 * still working and after it goes idle.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const DIST_ENTRY = join(process.cwd(), "dist", "index.js");
const PARENT = "ses_parent_bg";
const CHILD = "ses_child_bg";
/** PARALLEL_TASK.MIN_STABILITY_MS is 2s; a task younger than that is not "done" yet. */
const STABILITY_WAIT_MS = 2_600;
/** One PARALLEL_TASK.POLL_INTERVAL_MS (2s) plus margin for the poller to see the idle child. */
const POLL_WAIT_MS = 2_600;

interface SentPrompt {
    sessionID: string;
    busyAtSendTime: boolean;
    text: string;
    synthetic: boolean;
}

type ToolEntry = {
    name: string;
    execute: (input: unknown, context: { sessionID: string; messageID: string; agent: string; signal: AbortSignal }) => Promise<{ content: string }>;
};

function settle(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** Minimal push-based event stream standing in for `context.event.subscribe`. */
function createEventStream() {
    const queue: unknown[] = [];
    let wake: (() => void) | undefined;
    return {
        push(event: unknown) {
            queue.push(event);
            wake?.();
        },
        async *subscribe({ signal }: { signal?: AbortSignal } = {}) {
            while (!signal?.aborted) {
                if (queue.length === 0) {
                    await new Promise<void>(resolve => {
                        wake = resolve;
                        signal?.addEventListener("abort", () => resolve(), { once: true });
                    });
                    wake = undefined;
                    continue;
                }
                yield queue.shift();
            }
        },
    };
}

describe("background task notification never interrupts a working parent (issue #38)", () => {
    const sent: SentPrompt[] = [];
    let parentBusy = false;
    let launched = false;
    let launchResult = "";
    let dispose: (() => Promise<void>) | undefined;
    let workspace = "";

    beforeAll(async () => {
        if (!existsSync(DIST_ENTRY)) return;

        workspace = join(tmpdir(), `oco-e2e-bgnotify-${process.pid}`);
        rmSync(workspace, { recursive: true, force: true });
        mkdirSync(join(workspace, ".opencode"), { recursive: true });

        const events = createEventStream();
        const tools = new Map<string, ToolEntry>();
        const sessionHooks = new Map<string, (input: unknown) => Promise<void>>();
        const registration = () => Promise.resolve({ dispose: async () => undefined });
        const record = (sessionID: string, text: string, synthetic: boolean) => {
            sent.push({
                sessionID,
                busyAtSendTime: sessionID === PARENT ? parentBusy : false,
                text,
                synthetic,
            });
        };

        const context = {
            location: { directory: workspace, project: { directory: workspace } },
            options: {},
            agent: { list: async () => [], transform: () => registration() },
            command: { transform: () => registration() },
            model: { list: async () => ({ data: [] }) },
            event: { subscribe: (options: { signal?: AbortSignal }) => events.subscribe(options) },
            tool: {
                hook: () => registration(),
                transform: (edit: (editor: { add: (entry: ToolEntry) => void }) => void) => {
                    edit({ add: entry => tools.set(entry.name, entry) });
                    return registration();
                },
            },
            session: {
                hook: (name: string, handler: (input: unknown) => Promise<void>) => {
                    sessionHooks.set(name, handler);
                    return registration();
                },
                create: async () => ({ id: CHILD }),
                remove: async () => undefined,
                switchAgent: async () => undefined,
                interrupt: async () => ({ interrupted: true }),
                prompt: async ({ sessionID, text }: { sessionID: string; text: string }) => record(sessionID, text, false),
                synthetic: async ({ sessionID, text }: { sessionID: string; text: string }) => record(sessionID, text, true),
                // The subagent produced real output, so its idle counts as done.
                context: async () => [{
                    id: "msg_child_done",
                    type: "assistant",
                    time: { created: Date.now(), completed: Date.now() },
                    finish: "stop",
                    content: [{ type: "text", text: "Implemented the change and ran the tests." }],
                }],
            },
        };

        const { default: plugin } = await import(pathToFileURL(DIST_ENTRY).href);
        dispose = await plugin.setup(context);

        await sessionHooks.get("prompt")?.({ sessionID: PARENT, prompt: { text: "build the feature" } });

        const delegate = tools.get("delegate_task");
        if (!delegate) return;

        const result = await delegate.execute(
            {
                agent: "Worker",
                description: "background unit",
                prompt: "implement the change",
                background: true,
            },
            { sessionID: PARENT, messageID: "msg_parent", agent: "Commander", signal: new AbortController().signal },
        );
        launchResult = result.content;
        launched = result.content.includes("[SPAWNED]");

        // Both sessions are working: the child on its task, the parent on its
        // own turn — the exact situation the old code interrupted.
        parentBusy = true;
        events.push({ type: "session.execution.started", data: { sessionID: CHILD } });
        events.push({ type: "session.execution.started", data: { sessionID: PARENT } });
        await settle(STABILITY_WAIT_MS);

        // The subagent finishes; the poller notices on its next pass.
        events.push({ type: "session.execution.succeeded", data: { sessionID: CHILD } });
        await settle(POLL_WAIT_MS);

        // The parent's own turn finally ends. The deferred notice must arrive
        // now — holding it back must not mean losing it.
        parentBusy = false;
        events.push({ type: "session.execution.succeeded", data: { sessionID: PARENT } });
        await settle(1_200);
    }, 60_000);

    afterAll(async () => {
        await dispose?.();
        if (workspace) rmSync(workspace, { recursive: true, force: true });
    });

    it("launches the background task through the real tool", () => {
        expect(launched, `delegate_task did not run — the rest of this suite proves nothing: ${launchResult}`).toBe(true);
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
