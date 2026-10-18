/**
 * Strict review gate (opt-in `strictReview` plugin option, issue #55).
 *
 * When enabled, a Commander session that changed files — directly or through
 * the Workers it delegated to with `delegate_task` — is not allowed to finish
 * until a Reviewer task launched after the last change returns
 * `VERDICT: APPROVED`. The gate is driven by changed files, not by `/task`, so
 * plain natural-language requests are covered as well as missions.
 *
 * Decisions are made when the Commander session goes idle:
 * - no unreviewed changes                 → proceed (normal behavior)
 * - changes, no valid verdict             → ask Commander to delegate a review
 * - latest valid verdict is REJECTED      → send the findings back to Commander
 * - latest valid verdict is APPROVED      → proceed
 *
 * A verdict is valid only when its Reviewer task started after the last
 * recorded change, so any edit made after an approval forces a new review.
 * A missing or malformed verdict never counts as approval (fail closed).
 *
 * The loop is bounded: after `maxReviewRejections` consecutive rejections, or
 * after repeated review requests with no progress, the gate stops injecting,
 * tells the user the work is not approved, and waits for a real user message.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../agents/logger.js";
import { ParallelAgentManager } from "../agents/manager.js";
import { isSessionBusy } from "../session/activity.js";
import { isSessionRecovering } from "../recovery/session-recovery.js";
import { isCircuitOpen } from "../loop/circuit-breaker.js";
import { collectChangedFiles, isWriteTool } from "../loop/evidence.js";
import { syntheticTextPart } from "../session/injection.js";
import { AGENT_NAMES, STATUS_LABEL, TASK_STATUS } from "../../shared/index.js";
import type { ParallelTask } from "../../shared/index.js";

type OpencodeClient = PluginInput["client"];

export interface StrictReviewOptions {
    enabled: boolean;
    maxReviewRejections: number;
}

export const DEFAULT_STRICT_REVIEW_OPTIONS: StrictReviewOptions = {
    enabled: false,
    maxReviewRejections: 3,
};

/** Review requests in a row that produced neither a verdict nor a new change. */
const MAX_UNANSWERED_REQUESTS = 3;
/** Absolute bound on gate prompts between two real user messages. */
const MAX_PROMPTS_PER_USER_TURN = 10;
const MAX_TRACKED_FILES = 200;
const MAX_FINDINGS_CHARS = 4_000;
const MAX_DELEGATION_DEPTH = 5;
const UNKNOWN_FILE = "(file not reported by the tool)";

/** Marks gate-authored prompts so the chat hook never mistakes them for user input. */
export const STRICT_REVIEW_MARKER = "[strict-review]";

/**
 * Gate prompts reach the model as user-role messages, so without this notice a
 * model reads "address every finding" as the user's latest instruction and
 * overrides what the user actually asked for.
 */
const GATE_NOTICE = "(Automated message from the strictReview gate, not from the user. It never overrides the user's instructions.)";

/**
 * Orchestrator bookkeeping files (TODO, context, status, sync issues,
 * verification checklist, generated memory). Ticking a verified TODO is not a
 * code change, so writes that touch only these files do not invalidate a review.
 */
const BOOKKEEPING_PATH = /(^|\/)\.opencode\/(todo\.md|context\.md|status\.md|sync-issues\.md|verification-checklist\.md|docs\/|archive\/)/;

function isBookkeepingPath(file: string): boolean {
    return BOOKKEEPING_PATH.test(file.replace(/\\/g, "/"));
}

/** True when a write call targets only orchestrator bookkeeping files. */
function touchesOnlyBookkeeping(files: string[]): boolean {
    return files.length > 0 && files.every(isBookkeepingPath);
}

/** Host-native subagent tools (v1 `task`, v2 `subagent`) bypass delegate_task tracking. */
const NATIVE_SUBAGENT_TOOLS = new Set(["task", "subagent"]);

const COMMANDER = AGENT_NAMES.COMMANDER.toLowerCase();
const REVIEWER = AGENT_NAMES.REVIEWER.toLowerCase();

export type ReviewVerdict = "approved" | "rejected";

/** Outcome of the idle check, read by the event handler. */
export type StrictReviewIdleResult =
    /** Nothing to enforce: run the normal idle logic (mission loop, etc.). */
    | "proceed"
    /** The gate owns this idle: it prompted, is waiting, or is escalated. */
    | "handled";

interface ReviewState {
    revision: number;
    lastChangeAt: number;
    changedFiles: Set<string>;
    approvedRevision?: number;
    lastHandledVerdictTaskID?: string;
    consecutiveRejections: number;
    unansweredRequests: number;
    unansweredRevision?: number;
    promptsThisTurn: number;
    escalated: boolean;
    paused: boolean;
    inFlight: boolean;
}

let options: StrictReviewOptions = { ...DEFAULT_STRICT_REVIEW_OPTIONS };
const states = new Map<string, ReviewState>();
const sessionAgents = new Map<string, string>();

export function configureStrictReview(next: Partial<StrictReviewOptions>): void {
    options = { ...DEFAULT_STRICT_REVIEW_OPTIONS, ...next };
}

export function isStrictReviewEnabled(): boolean {
    return options.enabled;
}

export function getStrictReviewOptions(): StrictReviewOptions {
    return options;
}

/** Remember which agent a session runs as (from chat.message / v2 context). */
export function rememberSessionAgent(sessionID: string, agent: string | undefined): void {
    if (!options.enabled || !sessionID || !agent) return;
    sessionAgents.set(sessionID, agent.toLowerCase());
}

function agentOf(sessionID: string): string | undefined {
    const task = findTask(sessionID);
    if (task?.agent) return task.agent.toLowerCase();
    return sessionAgents.get(sessionID);
}

function findTask(sessionID: string): ParallelTask | undefined {
    try {
        return ParallelAgentManager.getInstance().getTaskBySession(sessionID);
    } catch {
        return undefined;
    }
}

/**
 * The root session that owns work done in `sessionID`: the session itself when
 * it is not a delegated task, otherwise the task's parent chain.
 */
export function resolveRootSession(sessionID: string): string {
    let current = sessionID;
    for (let depth = 0; depth < MAX_DELEGATION_DEPTH; depth++) {
        const task = findTask(current);
        if (!task?.parentSessionID) return current;
        current = task.parentSessionID;
    }
    return current;
}

function getState(rootSessionID: string): ReviewState {
    let state = states.get(rootSessionID);
    if (!state) {
        state = {
            revision: 0,
            lastChangeAt: 0,
            changedFiles: new Set(),
            consecutiveRejections: 0,
            unansweredRequests: 0,
            promptsThisTurn: 0,
            escalated: false,
            paused: false,
            inFlight: false,
        };
        states.set(rootSessionID, state);
    }
    return state;
}

function isDryRun(args: Record<string, unknown> | undefined): boolean {
    return args?.dry_run === true || args?.dryRun === true;
}

/**
 * Record a completed tool call. Write tools bump the owning root session's
 * revision, which invalidates any earlier approval.
 */
export function recordToolChange(
    sessionID: string,
    tool: string,
    args: Record<string, unknown> | undefined,
    now: number = Date.now(),
): void {
    if (!options.enabled || !sessionID || !tool) return;
    if (!isWriteTool(tool) || isDryRun(args)) return;
    const files = collectChangedFiles(tool, args);
    if (touchesOnlyBookkeeping(files)) return;

    const rootSessionID = resolveRootSession(sessionID);
    const state = getState(rootSessionID);
    state.revision += 1;
    state.lastChangeAt = now;
    for (const file of files.length > 0 ? files : [UNKNOWN_FILE]) {
        if (state.changedFiles.size < MAX_TRACKED_FILES) state.changedFiles.add(file);
    }
}

/**
 * Mechanical guards evaluated before a tool runs. Returns a reason when the
 * call must be refused, or undefined to allow it.
 */
export function checkToolAllowed(
    sessionID: string,
    tool: string,
    args?: Record<string, unknown>,
): string | undefined {
    if (!options.enabled || !sessionID || !tool) return undefined;
    const agent = agentOf(sessionID);
    const name = tool.toLowerCase();

    // The Reviewer may still record verified TODO/checklist items.
    if (agent === REVIEWER && isWriteTool(name) && !touchesOnlyBookkeeping(collectChangedFiles(name, args))) {
        return "strictReview: the Reviewer is read-only. Report findings with a verdict instead of editing files.";
    }
    if (agent === COMMANDER && NATIVE_SUBAGENT_TOOLS.has(name) && !findTask(sessionID)) {
        return "strictReview: delegate with delegate_task so delegated changes stay under review.";
    }
    return undefined;
}

/** True when the idle path must consult the gate for this session. */
export function isTracking(sessionID: string): boolean {
    if (!options.enabled) return false;
    const state = states.get(sessionID);
    return state !== undefined && state.revision > 0 && agentOf(sessionID) === COMMANDER;
}

/** Text of a gate-authored prompt, so the chat hook can recognise it. */
export function isStrictReviewPrompt(text: string): boolean {
    return text.trimStart().startsWith(STRICT_REVIEW_MARKER);
}

/** A real user message resets the loop bounds and lifts a pause or escalation. */
export function handleUserMessage(sessionID: string): void {
    const state = states.get(sessionID);
    if (!state) return;
    state.consecutiveRejections = 0;
    state.unansweredRequests = 0;
    state.unansweredRevision = undefined;
    state.promptsThisTurn = 0;
    state.escalated = false;
    state.paused = false;
}

/** The user interrupted the session: stop prompting until they speak again. */
export function handleAbort(sessionID: string): void {
    const state = states.get(sessionID);
    if (state) state.paused = true;
}

export function cleanupSession(sessionID: string): void {
    states.delete(sessionID);
    sessionAgents.delete(sessionID);
}

/** Test seam. */
export function resetStrictReview(): void {
    states.clear();
    sessionAgents.clear();
    options = { ...DEFAULT_STRICT_REVIEW_OPTIONS };
}

/**
 * Parse the Reviewer's machine-readable verdict. The last `VERDICT:` line wins.
 * Anything else — missing, misspelled, ambiguous — is `undefined` (not approved).
 */
export function parseReviewVerdict(text: string): { verdict: ReviewVerdict; findings: string } | undefined {
    const pattern = /^[\s>*`_-]*VERDICT:\s*\**\s*(APPROVED|REJECTED)\b[^\n]*$/gim;
    let match: RegExpExecArray | null;
    let last: RegExpExecArray | undefined;
    while ((match = pattern.exec(text)) !== null) last = match;
    if (!last) return undefined;
    const verdict = last[1].toUpperCase() === "APPROVED" ? "approved" : "rejected";
    const findings = text.slice(last.index + last[0].length).trim();
    return { verdict, findings };
}

interface ReviewerOutcome {
    taskID: string;
    verdict?: { verdict: ReviewVerdict; findings: string };
    failed: boolean;
}

function isReviewerTask(task: ParallelTask): boolean {
    return task.agent?.toLowerCase() === REVIEWER;
}

function isSettled(task: ParallelTask): boolean {
    return task.status !== TASK_STATUS.RUNNING && task.status !== TASK_STATUS.PENDING;
}

/**
 * The most recent Reviewer task for this root session that started after the
 * last change. Older reviews describe a different revision and are ignored.
 */
async function readLatestValidReview(
    rootSessionID: string,
    state: ReviewState,
): Promise<ReviewerOutcome | undefined> {
    let manager: ParallelAgentManager;
    try {
        manager = ParallelAgentManager.getInstance();
    } catch {
        return undefined;
    }
    const candidates = manager.getTasksByParent(rootSessionID)
        .filter(task => isReviewerTask(task) && isSettled(task))
        .filter(task => task.startedAt.getTime() >= state.lastChangeAt)
        .sort((a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0));
    const latest = candidates.at(-1);
    if (!latest) return undefined;

    if (latest.status !== TASK_STATUS.COMPLETED) {
        return { taskID: latest.id, failed: true };
    }
    try {
        const text = await manager.getResult(latest.id);
        return { taskID: latest.id, verdict: text ? parseReviewVerdict(text) : undefined, failed: false };
    } catch (error) {
        log("[strict-review] Failed to read reviewer result", { taskID: latest.id, error });
        return { taskID: latest.id, failed: true };
    }
}

function hasRunningTasks(rootSessionID: string): boolean {
    try {
        return ParallelAgentManager.getInstance().getTasksByParent(rootSessionID)
            .some(task => task.status === STATUS_LABEL.RUNNING || task.status === STATUS_LABEL.PENDING);
    } catch {
        return true;
    }
}

type GateAction =
    | { kind: "proceed" }
    | { kind: "wait" }
    | { kind: "prompt"; text: string }
    | { kind: "escalate"; text: string };

function changedFilesList(state: ReviewState): string {
    return [...state.changedFiles].map(file => `- ${file}`).join("\n");
}

function requestReviewPrompt(state: ReviewState, reason: string): string {
    return `${STRICT_REVIEW_MARKER} ${GATE_NOTICE}
Independent review required before this work can be considered done.
${reason}
Changed files since the last approval:
${changedFilesList(state)}

Delegate a review with delegate_task (agent: "Reviewer") covering the current changes and their acceptance criteria. The Reviewer must end with \`VERDICT: APPROVED\` or \`VERDICT: REJECTED\` followed by findings. Do not report the work as complete until a review started after your last change returns APPROVED.`;
}

function fixPrompt(findings: string, rejections: number, max: number): string {
    const trimmed = findings.length > MAX_FINDINGS_CHARS
        ? `${findings.slice(0, MAX_FINDINGS_CHARS)}\n…(truncated)`
        : findings;
    return `${STRICT_REVIEW_MARKER} ${GATE_NOTICE}
The Reviewer REJECTED the current changes (consecutive rejection ${rejections}; automatic review stops at ${max}).
Findings:
${trimmed || "(the Reviewer gave no findings)"}

If any finding conflicts with an explicit instruction from the user, do not override the user: explain the conflict, ask how to proceed, and stop. The changes stay unapproved until the user decides.
Otherwise, address every finding, then delegate a new review. Do not report the work as complete until a new review returns APPROVED.`;
}

function escalationPrompt(state: ReviewState, reason: string): string {
    return `${STRICT_REVIEW_MARKER} ${GATE_NOTICE}
Automatic review stopped: ${reason}
Tell the user plainly that the current changes are NOT approved, summarize the outstanding findings or the missing review, and list the changed files:
${changedFilesList(state)}

Do not make further changes or claim completion until the user responds.`;
}

async function decide(rootSessionID: string, state: ReviewState): Promise<GateAction> {
    if (state.approvedRevision === state.revision) return { kind: "proceed" };
    if (state.escalated || state.paused) return { kind: "wait" };
    if (hasRunningTasks(rootSessionID)) return { kind: "wait" };

    const review = await readLatestValidReview(rootSessionID, state);
    if (review?.verdict?.verdict === "approved") {
        state.approvedRevision = state.revision;
        state.lastHandledVerdictTaskID = review.taskID;
        state.consecutiveRejections = 0;
        state.unansweredRequests = 0;
        state.unansweredRevision = undefined;
        state.changedFiles.clear();
        return { kind: "proceed" };
    }

    if (state.promptsThisTurn >= MAX_PROMPTS_PER_USER_TURN) {
        return { kind: "escalate", text: escalationPrompt(state, `the review loop reached ${MAX_PROMPTS_PER_USER_TURN} prompts without an approval.`) };
    }

    if (review?.verdict?.verdict === "rejected" && review.taskID !== state.lastHandledVerdictTaskID) {
        state.lastHandledVerdictTaskID = review.taskID;
        state.consecutiveRejections += 1;
        state.unansweredRequests = 0;
        state.unansweredRevision = state.revision;
        if (state.consecutiveRejections >= options.maxReviewRejections) {
            return { kind: "escalate", text: escalationPrompt(state, `the Reviewer rejected the changes ${state.consecutiveRejections} times in a row.\nLatest findings:\n${review.verdict.findings.slice(0, MAX_FINDINGS_CHARS)}`) };
        }
        return { kind: "prompt", text: fixPrompt(review.verdict.findings, state.consecutiveRejections, options.maxReviewRejections) };
    }

    // The rejection was already sent back and nothing changed since: Commander
    // chose not to act (e.g. the findings conflict with the user's instructions).
    // Hand the decision to the user instead of pushing the same findings again.
    if (review?.verdict?.verdict === "rejected") {
        return { kind: "escalate", text: escalationPrompt(state, `Commander did not act on the Reviewer's rejection.\nLatest findings:\n${review.verdict.findings.slice(0, MAX_FINDINGS_CHARS)}`) };
    }

    // No new verdict to act on: count requests that produced no progress.
    if (state.unansweredRevision !== state.revision) {
        state.unansweredRevision = state.revision;
        state.unansweredRequests = 0;
    }
    state.unansweredRequests += 1;
    if (state.unansweredRequests > MAX_UNANSWERED_REQUESTS) {
        return { kind: "escalate", text: escalationPrompt(state, "review was requested repeatedly but no valid Reviewer verdict was produced.") };
    }

    const reason = review === undefined
        ? "No Reviewer task has reviewed the latest changes."
        : review.failed
            ? "The latest Reviewer task failed or was cancelled, so it does not count as a review."
            : "The latest Reviewer result has no valid `VERDICT: APPROVED` or `VERDICT: REJECTED` line, so it does not count as approval.";
    return { kind: "prompt", text: requestReviewPrompt(state, reason) };
}

async function sendPrompt(client: OpencodeClient, sessionID: string, text: string): Promise<boolean> {
    try {
        const response = await client.session.prompt({
            path: { id: sessionID },
            body: { parts: [syntheticTextPart(text)] },
        });
        if (response?.error) throw new Error(String(response.error));
        return true;
    } catch (error) {
        log("[strict-review] Failed to send review prompt", { sessionID, error });
        return false;
    }
}

/**
 * Idle entry point. Called by the event handler before the mission loop runs.
 * Returns "handled" whenever the gate holds the session, so a mission can never
 * complete while changes are unreviewed.
 */
export async function handleStrictReviewIdle(
    client: OpencodeClient,
    sessionID: string,
): Promise<StrictReviewIdleResult> {
    if (!isTracking(sessionID)) return "proceed";
    const state = getState(sessionID);
    if (state.approvedRevision === state.revision) return "proceed";
    if (state.inFlight) return "handled";

    state.inFlight = true;
    try {
        if (isSessionRecovering(sessionID) || isCircuitOpen(sessionID)) return "handled";
        const action = await decide(sessionID, state);
        if (action.kind === "proceed") return "proceed";
        if (action.kind === "wait") return "handled";
        if (await isSessionBusy(client, sessionID)) return "handled";

        if (action.kind === "escalate") {
            state.escalated = true;
            log("[strict-review] Escalated to the user", { sessionID, revision: state.revision });
        }
        if (await sendPrompt(client, sessionID, action.text)) {
            state.promptsThisTurn += 1;
        }
        return "handled";
    } finally {
        state.inFlight = false;
    }
}

/** Instructions appended to the system prompt while strict review is enabled. */
export function strictReviewSystemAddition(sessionID: string, agent: string | undefined): string | undefined {
    if (!options.enabled) return undefined;
    const role = (agent || agentOf(sessionID) || "").toLowerCase();
    if (role === COMMANDER) {
        return `<strict_review>
Strict review is enabled. Code you or your Workers change is not done until a Reviewer task launched with delegate_task (agent: "Reviewer") after the last change returns \`VERDICT: APPROVED\`. Do not report implementation work as complete before that. When the Reviewer returns REJECTED, address every finding and request a new review, unless a finding conflicts with an explicit user instruction: then explain the conflict and ask the user instead of overriding them. Delegate with delegate_task, not host-native subagent tools, so delegated changes stay under review.
</strict_review>`;
    }
    if (role === REVIEWER) {
        return `<strict_review>
Strict review is enabled and you are read-only: do not edit project files (recording verified items in the .opencode TODO or checklist is the only exception). Inspect the current changes (for example with git diff), run the project's applicable checks, and judge them against the acceptance criteria. End your reply with exactly one verdict line, \`VERDICT: APPROVED\` or \`VERDICT: REJECTED\`. After REJECTED, list each finding as \`- path:line — reason\`.
</strict_review>`;
    }
    return undefined;
}
