/**
 * Deferred prompt injection queue.
 *
 * `message.updated` with `time.completed` does NOT mean "the turn is over". The
 * upstream run loop completes the assistant message at the end of every *step*
 * and then continues to the next one whenever the model asked for tool calls
 * (`SessionPrompt.runLoop` → `SessionProcessor` sets `time.completed`, the loop
 * returns `"continue"`). A turn that makes ten tool calls therefore emits ten
 * completed assistant messages.
 *
 * The done-hooks fire on each of those. Sending their prompts immediately meant
 * the mission loop pushed "you have not finished, continue" into the session
 * after every single tool call, which the model experiences as being repeatedly
 * interrupted while it is working (issue #38).
 *
 * So done-hook prompts are queued here instead, and flushed once the session
 * actually goes idle. The queue holds only the most recent set: these prompts
 * are snapshots of current mission state, so an older copy carries nothing the
 * newer one does not.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";
import { isSessionBusy } from "./activity.js";
import { syntheticTextParts } from "./injection.js";

type OpencodeClient = PluginInput["client"];

const pending = new Map<string, string[]>();

/**
 * Hold prompts until the session is idle. Replaces any set already queued for
 * this session rather than appending to it.
 */
export function queuePrompts(sessionID: string, prompts: readonly string[]): void {
    const kept = prompts.filter(prompt => prompt.trim().length > 0);
    if (!sessionID || kept.length === 0) return;

    pending.set(sessionID, dedupe(kept));
}

/** Prompts currently waiting for this session to go idle. */
export function peekPrompts(sessionID: string): string[] {
    return [...(pending.get(sessionID) ?? [])];
}

export function hasPendingPrompts(sessionID: string): boolean {
    return (pending.get(sessionID)?.length ?? 0) > 0;
}

export function clearPrompts(sessionID: string): void {
    pending.delete(sessionID);
}

/** Test seam: forget every queued session. */
export function resetPendingInjections(): void {
    pending.clear();
}

/**
 * Send the queued prompts as one synthetic message, if the session is genuinely
 * idle. Returns true when something was sent.
 *
 * The queue is cleared before the request so a failure cannot strand prompts
 * that would then be replayed against a much later turn; the next completed step
 * re-queues a fresh snapshot anyway.
 */
export async function flushPrompts(client: OpencodeClient, sessionID: string): Promise<boolean> {
    const prompts = pending.get(sessionID);
    if (!prompts || prompts.length === 0) return false;

    if (await isSessionBusy(client, sessionID)) {
        log("[pending-injection] Held back: session is busy", { sessionID, queued: prompts.length });
        return false;
    }

    pending.delete(sessionID);

    try {
        await client.session.prompt({
            path: { id: sessionID },
            body: { parts: syntheticTextParts(prompts) },
        });
        log("[pending-injection] Flushed queued prompts", { sessionID, count: prompts.length });
        return true;
    } catch (error) {
        log("[pending-injection] Failed to flush queued prompts", { sessionID, error });
        return false;
    }
}

function dedupe(prompts: string[]): string[] {
    return [...new Set(prompts)];
}
