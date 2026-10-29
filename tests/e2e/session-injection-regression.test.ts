/**
 * End-to-end regression guard for issues #35, #37 and #38.
 *
 * Runs the built `dist/index.js` bundle — the artifact users actually install —
 * against a fake OpenCode 2 plugin context, driving the event sequence that produced the
 * bug reports: an active mission, a turn that makes several tool calls (so the
 * run loop completes an assistant message per step, mid-turn), and only then a
 * real idle.
 *
 * Against v1.7.10 this scenario produced four mid-turn injections, ten
 * non-synthetic text parts and a spurious "STAGNATION DETECTED". Those are the
 * exact symptoms in the reports, so this test is the thing that proves the fix
 * rather than restating it.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { MISSION_CONTROL } from "../../src/shared/loop/constants";

const DIST_ENTRY = join(process.cwd(), "dist", "index.js");
const SESSION = "ses_e2e_injection";
const STEP_COUNT = 4;

interface SentPrompt {
    busyAtSendTime: boolean;
    text: string;
    synthetic: boolean;
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
    writeFileSync(join(opencodeDir, MISSION_CONTROL.STATE_FILE), JSON.stringify({
        active: true,
        iteration: 1,
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

type Hook = (input: unknown) => Promise<void>;

/** A push-driven stand-in for the host's event subscription. */
function createEventStream() {
    const queue: unknown[] = [];
    let wake: (() => void) | undefined;
    let closed = false;
    return {
        push(event: unknown) {
            queue.push(event);
            wake?.();
        },
        close() {
            closed = true;
            wake?.();
        },
        async *subscribe({ signal }: { signal?: AbortSignal } = {}) {
            signal?.addEventListener("abort", () => { closed = true; wake?.(); });
            while (!closed) {
                const next = queue.shift();
                if (next !== undefined) { yield next; continue; }
                await new Promise<void>(resolve => { wake = resolve; });
                wake = undefined;
            }
        },
    };
}

interface FakeHostOptions {
    workspace: string;
    isBusy: () => boolean;
    sent: SentPrompt[];
    messages: (sessionID: string) => unknown[];
}

/** Boot the bundled plugin against a fake OpenCode 2 context. */
async function bootPlugin({ workspace, isBusy, sent, messages }: FakeHostOptions) {
    const hooks = new Map<string, Hook>();
    const events = createEventStream();
    const registration = async () => ({ dispose: async () => {} });
    const hook = async (name: string, callback: Hook) => { hooks.set(name, callback); return registration(); };
    const record = (synthetic: boolean) => async ({ sessionID, text }: { sessionID: string; text: string }) => {
        expect(sessionID).toBe(SESSION);
        sent.push({ busyAtSendTime: isBusy(), text, synthetic });
    };
    const context = {
        location: { directory: workspace, project: { directory: workspace } },
        options: {},
        agent: { list: async () => [], transform: registration },
        session: {
            hook,
            prompt: record(false),
            synthetic: record(true),
            switchAgent: async () => {},
            context: async ({ sessionID }: { sessionID: string }) => messages(sessionID),
            interrupt: async () => ({ interrupted: true }),
            create: async () => ({ id: "ses_child" }),
        },
        model: { list: async () => ({ data: [] }) },
        tool: { hook, transform: registration },
        command: { transform: registration },
        event: { subscribe: events.subscribe },
    };
    const { default: plugin } = await import(pathToFileURL(DIST_ENTRY).href);
    const dispose: () => Promise<void> = await plugin.setup(context);
    return {
        prompt: (text: string) => hooks.get("prompt")!({ sessionID: SESSION, prompt: { text } }),
        fire: async (type: string, data: Record<string, unknown> = {}) => {
            events.push({ type, data: { sessionID: SESSION, ...data } });
            await settle(20);
        },
        dispose: async () => {
            events.close();
            await dispose();
        },
    };
}

describe("session injection regression (issues #35, #37, #38)", () => {
    const sent: SentPrompt[] = [];
    let hostBusy = false;
    let host: Awaited<ReturnType<typeof bootPlugin>> | undefined;

    beforeAll(async () => {
        // Requires a build; dist-integrity.test.ts covers the bundle's presence.
        if (!existsSync(DIST_ENTRY)) return;

        const workspace = seedMissionWorkspace();
        const created = Date.now();
        host = await bootPlugin({
            workspace,
            isBusy: () => hostBusy,
            sent,
            messages: () => Array.from({ length: STEP_COUNT }, (_, index) => ({
                id: `msg_step_${index + 1}`,
                type: "assistant",
                time: { created, completed: created },
                finish: "tool-calls",
                content: [{ type: "text", text: LONG_HEALTHY_OUTPUT }, { type: "tool", tool: "read" }],
            })),
        });

        await host.prompt("/task Implement the feature");

        // The turn starts and stays busy across several tool-calling steps.
        hostBusy = true;
        await host.fire("session.execution.started");

        for (let step = 1; step <= STEP_COUNT; step++) {
            await host.fire("session.step.ended", {
                assistantMessageID: `msg_step_${step}`,
                tokens: { input: 1000, output: 200, reasoning: 0 },
            });
            await settle(120);
        }
        await settle(400);

        // Only now does the turn actually end.
        hostBusy = false;
        await host.fire("session.execution.succeeded");
        // The sole mission continuation owner applies its three-second countdown.
        const deadline = Date.now() + 6000;
        while (sent.length === 0 && Date.now() < deadline) await settle(50);
    }, 60_000);

    afterAll(async () => {
        await host?.dispose();
    });

    it("never injects while the session is still working", () => {
        const midTurn = sent.filter(entry => entry.busyAtSendTime);
        const texts = midTurn.map(entry => entry.text.slice(0, 80));

        expect(midTurn.length, `injected mid-turn: ${JSON.stringify(texts)}`).toBe(0);
    });

    it("still delivers the continuation once the session goes idle", () => {
        if (!existsSync(DIST_ENTRY)) return;
        // The guard must hold prompts back, not silently kill the mission loop.
        expect(sent.filter(entry => !entry.busyAtSendTime).length).toBeGreaterThan(0);
        expect(sent.some(entry => entry.text.includes("<mission_loop"))).toBe(true);
    });

    it("sends every injection as synthetic so the TUI does not show it as user input", () => {
        const plain = sent.filter(entry => !entry.synthetic);

        expect(plain.map(entry => entry.text.slice(0, 60))).toEqual([]);
    });

    it("raises no output anomaly for long healthy assistant output", () => {
        const anomalies = sent.filter(entry => entry.text.includes("ANOMALY"));

        expect(anomalies.map(entry => entry.text.slice(0, 80))).toEqual([]);
    });
});

/**
 * Regression guard for the recovery path fixed in 1.7.12.
 *
 * An error report does not mean the run stopped. When the host reports an
 * error while the session is still executing, injecting a recovery prompt
 * would interrupt a run that is already recovering on its own — and v1.7.11
 * did exactly that.
 */
describe("recovery never interrupts an in-flight run (issue #38)", () => {
    const sent: SentPrompt[] = [];
    let host: Awaited<ReturnType<typeof bootPlugin>> | undefined;

    beforeAll(async () => {
        if (!existsSync(DIST_ENTRY)) return;

        const workspace = seedMissionWorkspace();
        // Stays busy for the whole scenario: the runtime is still executing.
        host = await bootPlugin({ workspace, isBusy: () => true, sent, messages: () => [] });

        await host.prompt("do the work");
        await host.fire("session.execution.started");
        await host.fire("session.error", { error: { name: "Error", message: "tool_result_missing" } });
        await settle(600);
    }, 60_000);

    afterAll(async () => {
        await host?.dispose();
    });

    it("holds the recovery prompt while the runtime is still executing", () => {
        const texts = sent.map(entry => entry.text.slice(0, 60));

        expect(sent.length, `injected during execution: ${JSON.stringify(texts)}`).toBe(0);
    });
});
