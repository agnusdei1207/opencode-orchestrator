/**
 * End-to-end guard for the opt-in strict review gate (issue #55).
 *
 * Drives the built `dist/index.js` bundle against a fake OpenCode client:
 * a Commander session edits a file from a plain natural-language request (no
 * `/task`), then goes idle. With `strictReview` enabled the plugin must ask for
 * an independent review; with it disabled nothing may change. A mission whose
 * own verification already passes must not complete while edits are unreviewed.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { MISSION_CONTROL } from "../../src/shared/loop/constants";

const DIST_ENTRY = join(process.cwd(), "dist", "index.js");
const MARKER = "[strict-review]";

interface SentPrompt {
    sessionID: string;
    parts: Array<{ type: string; text?: string; synthetic?: boolean }>;
}

function settle(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createWorkspace(name: string): string {
    const workspace = join(tmpdir(), `oco-e2e-strict-${name}-${process.pid}`);
    rmSync(workspace, { recursive: true, force: true });
    mkdirSync(join(workspace, ".opencode"), { recursive: true });
    return workspace;
}

function createClient(sessionID: string, sent: SentPrompt[]) {
    return {
        session: {
            prompt: async ({ path, body }: any) => {
                sent.push({ sessionID: path.id, parts: body.parts });
                return { data: {} };
            },
            status: async () => ({ data: {} }),
            message: async () => ({ data: { parts: [{ type: "text", text: "Done: updated src/app.ts." }] } }),
            messages: async () => ({ data: [] }),
            todo: async () => ({ data: [] }),
            get: async () => ({ data: { id: sessionID } }),
        },
        tui: { showToast: async () => ({ data: true }) },
        app: { log: async () => ({ data: true }) },
    };
}

async function loadPlugin(workspace: string, client: unknown, options: Record<string, unknown>) {
    const { default: plugin } = await import(pathToFileURL(DIST_ENTRY).href);
    return plugin.server({ directory: workspace, client, worktree: workspace, $: () => {} }, options);
}

async function runEditThenIdle(hooks: any, sessionID: string, text: string): Promise<void> {
    const fire = (event: unknown) => hooks.event?.({ event });
    await fire({ type: "session.created", properties: { info: { id: sessionID } } });
    await hooks["chat.message"]?.(
        { sessionID, agent: "Commander" },
        { message: { sessionID, role: "user" }, parts: [{ type: "text", text }] },
    );
    await hooks["tool.execute.after"]?.(
        { sessionID, tool: "edit", callID: "call_1", args: { filePath: "src/app.ts" } },
        { title: "edit", output: "ok", metadata: {} },
    );
    await fire({
        type: "message.updated",
        properties: {
            info: {
                id: "msg_done",
                sessionID,
                role: "assistant",
                time: { created: Date.now(), completed: Date.now() },
            },
        },
    });
    await fire({ type: "session.status", properties: { sessionID, status: { type: "idle" } } });
    await fire({ type: "session.idle", properties: { sessionID } });
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate() && Date.now() < deadline) await settle(50);
}

const markerPrompts = (sent: SentPrompt[]) => sent.filter(entry =>
    entry.parts.some(part => part.text?.startsWith(MARKER)));

describe("strict review gate (issue #55)", () => {
    describe("natural-language request without /task", () => {
        const SESSION = "ses_e2e_strict_plain";
        const sent: SentPrompt[] = [];
        let hooks: any;

        beforeAll(async () => {
            if (!existsSync(DIST_ENTRY)) return;
            const workspace = createWorkspace("plain");
            hooks = await loadPlugin(workspace, createClient(SESSION, sent), { strictReview: true });
            await runEditThenIdle(hooks, SESSION, "Fix the rounding bug in the totals module");
            await waitFor(() => markerPrompts(sent).length > 0, 3_000);
        }, 30_000);

        it("asks Commander for an independent review after an unreviewed edit", () => {
            const prompts = markerPrompts(sent);
            expect(prompts).toHaveLength(1);
            expect(prompts[0].sessionID).toBe(SESSION);
            expect(prompts[0].parts[0].text).toContain("- src/app.ts");
        });

        it("sends the review request as a synthetic part", () => {
            expect(markerPrompts(sent).flatMap(entry => entry.parts).every(part => part.synthetic === true)).toBe(true);
        });

        it("blocks host-native subagent delegation for Commander", async () => {
            await expect(hooks["tool.execute.before"]?.(
                { sessionID: SESSION, tool: "task", callID: "call_2" },
                { args: { subagent_type: "Worker" } },
            )).rejects.toThrow(/delegate_task/);
        });
    });

    describe("disabled by default", () => {
        const SESSION = "ses_e2e_strict_off";
        const sent: SentPrompt[] = [];

        beforeAll(async () => {
            if (!existsSync(DIST_ENTRY)) return;
            const workspace = createWorkspace("off");
            const hooks = await loadPlugin(workspace, createClient(SESSION, sent), {});
            await runEditThenIdle(hooks, SESSION, "Fix the rounding bug in the totals module");
            await settle(1_500);
        }, 30_000);

        it("never prompts and never blocks", () => {
            expect(sent).toEqual([]);
        });
    });

    describe("active mission whose own verification passes", () => {
        const SESSION = "ses_e2e_strict_mission";
        const sent: SentPrompt[] = [];
        let workspace = "";

        beforeAll(async () => {
            if (!existsSync(DIST_ENTRY)) return;
            workspace = createWorkspace("mission");
            const opencodeDir = join(workspace, ".opencode");
            writeFileSync(join(opencodeDir, "todo.md"), "# TODO\n\n- [x] Implement the feature\n");
            writeFileSync(join(opencodeDir, MISSION_CONTROL.STATE_FILE), JSON.stringify({
                active: true,
                iteration: 1,
                maxIterations: 50,
                prompt: "Implement the feature",
                objective: "Implement the feature",
                sessionID: SESSION,
                startedAt: new Date().toISOString(),
            }));
            const hooks = await loadPlugin(workspace, createClient(SESSION, sent), { strictReview: true });
            await runEditThenIdle(hooks, SESSION, "/task Implement the feature");
            await waitFor(() => markerPrompts(sent).length > 0, 3_000);
            await settle(500);
        }, 30_000);

        it("holds the mission open and asks for review instead of completing", () => {
            expect(markerPrompts(sent)).toHaveLength(1);
            const state = JSON.parse(readFileSync(join(workspace, ".opencode", MISSION_CONTROL.STATE_FILE), "utf8"));
            expect(state.active).toBe(true);
        });
    });
});
