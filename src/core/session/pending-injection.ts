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
 * Anything written to a session while that loop is running lands *inside* the
 * turn the model is still executing — `SessionPrompt.prompt` persists the user
 * message before `ensureRunning`, and `noReply: true` only skips starting a new
 * run, it still writes the message. That is what made the orchestrator feel like
 * it was interrupting the model mid tool call (issue #38).
 *
 * So everything the plugin wants to say to a busy session is parked here and
 * sent at the next real idle. Two kinds of content, with different rules:
 *
 * - **snapshots** — mission state ("you have not finished, continue"). Only the
 *   newest matters; an older copy says nothing the newer one does not.
 * - **notices** — one-shot facts the model cannot reconstruct, such as "your
 *   background tasks finished". These accumulate and must never be dropped.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";
import { isSessionBusy } from "./activity.js";
import { syntheticTextParts } from "./injection.js";
import { createPruneTimer } from "../loop/prune-timer.js";

type OpencodeClient = PluginInput["client"];

interface PendingEntry {
    /** Latest mission-state snapshot; replaced wholesale. */
    snapshot: string[];
    /** One-shot notifications; appended, never overwritten. */
    notices: string[];
    /** For TTL pruning, since a queue is only cleared on flush or delete. */
    updatedAt: number;
}

/** Bound the notice backlog so a runaway producer cannot grow it forever. */
const MAX_NOTICES = 20;
/**
 * A queue that never reaches an idle boundary — the session was abandoned, the
 * client went away — would otherwise be held for the life of the process, and
 * flushing it hours later would be worse than dropping it.
 */
const PENDING_TTL_MS = 30 * 60 * 1000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;

const pending = new Map<string, PendingEntry>();
const flushing = new Set<string>();

const pruneTimer = createPruneTimer({
    intervalMs: PRUNE_INTERVAL_MS,
    prune: () => prunePendingInjections(),
});

function entryFor(sessionID: string): PendingEntry {
    let entry = pending.get(sessionID);
    if (!entry) {
        entry = { snapshot: [], notices: [], updatedAt: Date.now() };
        pending.set(sessionID, entry);
    }
    entry.updatedAt = Date.now();
    return entry;
}

function clean(prompts: readonly string[]): string[] {
    return prompts.filter(prompt => prompt.trim().length > 0);
}

/**
 * Hold a mission-state snapshot until the session is idle. Replaces any
 * snapshot already queued for this session rather than appending to it.
 */
export function queuePrompts(sessionID: string, prompts: readonly string[]): void {
    const kept = clean(prompts);
    if (!sessionID || kept.length === 0) return;

    entryFor(sessionID).snapshot = [...new Set(kept)];
}

/**
 * Hold a one-shot notification until the session is idle. Unlike a snapshot,
 * this is additive: losing it would lose information the model cannot recover.
 */
export function queueNotice(sessionID: string, notice: string): void {
    if (!sessionID || notice.trim().length === 0) return;

    const entry = entryFor(sessionID);
    if (entry.notices.length >= MAX_NOTICES) {
        log("[pending-injection] Notice backlog full, dropping oldest", { sessionID });
        entry.notices.shift();
    }
    entry.notices.push(notice);
}

/** Everything currently waiting for this session to go idle, in send order. */
export function peekPrompts(sessionID: string): string[] {
    const entry = pending.get(sessionID);
    if (!entry) return [];
    return [...entry.notices, ...entry.snapshot];
}

export function hasPendingPrompts(sessionID: string): boolean {
    return peekPrompts(sessionID).length > 0;
}

export function clearPrompts(sessionID: string): void {
    pending.delete(sessionID);
}

/** Drop queues for sessions that never came back to an idle boundary. */
function prunePendingInjections(now: number = Date.now()): void {
    for (const [sessionID, entry] of pending.entries()) {
        if (now - entry.updatedAt > PENDING_TTL_MS) {
            pending.delete(sessionID);
            log("[pending-injection] Pruned stale queue", { sessionID });
        }
    }
}

/** Stop the prune timer and drop all queues, for plugin shutdown. */
export function shutdownPendingInjections(): void {
    pruneTimer.shutdown();
    pending.clear();
}

/** Test seam: forget every queued session. */
export function resetPendingInjections(): void {
    pending.clear();
}

/**
 * Send everything queued as one synthetic message, if the session is genuinely
 * idle. Returns true when something was sent.
 *
 * Acknowledge only the captured batch after acceptance. Failed sends retain
 * one-shot notices; stale mission snapshots are refreshed by their producer.
 */
export async function flushPrompts(client: OpencodeClient, sessionID: string): Promise<boolean> {
    const entry = pending.get(sessionID);
    if (!entry || flushing.has(sessionID)) return false;
    const notices = [...entry.notices];
    const snapshot = entry.snapshot;
    const prompts = [...notices, ...snapshot];
    if (!prompts.length) return false;
    flushing.add(sessionID);
    try {
        if (await isSessionBusy(client, sessionID)) return false;
        if (pending.get(sessionID) !== entry || entry.snapshot !== snapshot) return false;
        const response = await client.session.prompt({
            path: { id: sessionID },
            body: { parts: syntheticTextParts(prompts) },
        });
        if (response.error) throw new Error(String(response.error));
        acknowledgeEntry(sessionID, entry, notices, snapshot);
        log("[pending-injection] Flushed queued prompts", { sessionID, count: prompts.length });
        return true;
    } catch (error) {
        acknowledgeEntry(sessionID, entry, [], snapshot);
        log("[pending-injection] Failed to flush queued prompts", { sessionID, error });
        return false;
    } finally {
        flushing.delete(sessionID);
    }
}

function acknowledgeEntry(sessionID: string, entry: PendingEntry, notices: string[], snapshot: string[]): void {
    if (pending.get(sessionID) !== entry) return;
    for (const notice of notices) {
        const index = entry.notices.indexOf(notice);
        if (index !== -1) entry.notices.splice(index, 1);
    }
    if (entry.snapshot === snapshot) entry.snapshot = [];
    if (!entry.notices.length && !entry.snapshot.length) pending.delete(sessionID);
}

pruneTimer.start();
