/**
 * Mission evidence store (Builder learning, adoption assessment item C).
 *
 * Builder treats a model's "done" as a candidate until the runtime has recorded
 * enough evidence to close the task (`builder_app/src/plumbing_trace.rs`:
 * changed files must be traced/verified). Orchestrator is a plugin and cannot
 * own the per-turn loop, but it DOES own the mission-loop continuation decision.
 *
 * This module records, by observing `tool.execute.after`, which files a session
 * changed and whether a verification command (test/build/lint) ran afterward. A
 * "wiring gap" exists when files were changed with no later verification. The
 * gap is surfaced as an emphatic continuation nudge — never a hard block — so it
 * can never cause a false "not done" loop.
 */

interface SessionEvidence {
    changedFiles: Set<string>;
    lastChangeAt: number;
    lastVerifyAt: number;
}

const MAX_TRACKED_FILES = 200;
const store = new Map<string, SessionEvidence>();

/** Tools (OpenCode built-ins + orchestrator tools) that mutate files. */
const WRITE_TOOLS = new Set([
    "write",
    "edit",
    "patch",
    "multiedit",
    "multi_patch",
    "apply_patch",
    "sed_replace",
    "ast_replace",
]);

/** Shell-like tools whose command we inspect for verification intent. */
const SHELL_TOOLS = new Set(["bash", "shell", "run_command", "run_background"]);

/** A command counts as verification when it runs tests/build/lint/typecheck. */
const VERIFY_HINT =
    /\b(test|spec|vitest|jest|pytest|build|tsc|typecheck|lint|eslint|clippy|cargo\s+test|npm\s+test|go\s+test|check)\b/i;

function ensure(sessionID: string): SessionEvidence {
    let evidence = store.get(sessionID);
    if (!evidence) {
        evidence = { changedFiles: new Set(), lastChangeAt: 0, lastVerifyAt: 0 };
        store.set(sessionID, evidence);
    }
    return evidence;
}

export function recordChangedFile(sessionID: string, filePath: string, now: number = Date.now()): void {
    if (!sessionID || !filePath) return;
    const evidence = ensure(sessionID);
    if (evidence.changedFiles.size < MAX_TRACKED_FILES) {
        evidence.changedFiles.add(filePath);
    }
    evidence.lastChangeAt = now;
}

export function recordVerification(sessionID: string, now: number = Date.now()): void {
    if (!sessionID) return;
    ensure(sessionID).lastVerifyAt = now;
}

/** Record evidence from a single observed tool call. */
export function recordToolEvidence(
    sessionID: string,
    tool: string,
    args: Record<string, unknown> | undefined,
    now: number = Date.now(),
): void {
    if (!sessionID || !tool) return;
    const name = tool.toLowerCase();
    if (WRITE_TOOLS.has(name)) {
        const candidate = args?.filePath ?? args?.path ?? args?.file;
        if (typeof candidate === "string") recordChangedFile(sessionID, candidate, now);
    } else if (SHELL_TOOLS.has(name)) {
        const command = String(args?.command ?? args?.cmd ?? "");
        if (VERIFY_HINT.test(command)) recordVerification(sessionID, now);
    }
}

/** Number of changed files with no verification recorded after the last change. */
export function getUnverifiedChangeCount(sessionID: string): number {
    const evidence = store.get(sessionID);
    if (!evidence || evidence.changedFiles.size === 0) return 0;
    return evidence.lastVerifyAt >= evidence.lastChangeAt ? 0 : evidence.changedFiles.size;
}

export function getChangedFiles(sessionID: string): string[] {
    return Array.from(store.get(sessionID)?.changedFiles ?? []);
}

export function clearEvidence(sessionID: string): void {
    store.delete(sessionID);
}
