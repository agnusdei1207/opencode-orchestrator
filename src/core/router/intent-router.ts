/**
 * Intent Analysis Router
 *
 * Front-door classifier for the Commander. Decides, per user turn, WHICH
 * context blocks the system-transform handler should inject — instead of
 * unconditionally injecting every block on every turn.
 *
 * Design (see docs/plans/2026-06-24/PLAN_IntentRouter):
 *  - Intent labels (semantic) are decoupled from injected volume (profile).
 *  - The router only REDUCES; any doubt escalates to FULL.
 *  - Core blocks (commander prompt + mission loop) are never gated here; this
 *    module only governs the auxiliary blocks.
 *  - Phase 1 is 100% rule-based: local-first, zero latency, deterministic.
 *  - Decisions are consume-once; a missing decision falls back to FULL.
 */

export type Intent =
    | "simple-qa"
    | "code-edit"
    | "planning"
    | "mission-step"
    | "clarify";

export type ContextProfile = "MINIMAL" | "STANDARD" | "FULL";

export type ContextNeed = "rag" | "scratchpad" | "active-session" | "background";

export interface RouterSignals {
    /** A mission loop is active for this session. */
    missionActive: boolean;
    /** The orchestrator session is in active execution. */
    sessionActive: boolean;
    /** The user message is a slash command. */
    isSlashCommand: boolean;
}

export interface RouterDecision {
    intent: Intent;
    profile: ContextProfile;
    needs: ContextNeed[];
    /** Delegation routing is out of scope; always the Commander for now. */
    route: "commander";
    confidence: number;
    source: "rule" | "model" | "fallback";
}

export const ROUTER_CONFIG = {
    /** Prompts at or below this length are eligible for the lightest profiles. */
    shortPromptThreshold: 120,
    /** Decisions below this confidence escalate one profile tier. */
    confidenceThreshold: 0.7,
} as const;

const PROFILE_NEEDS: Record<ContextProfile, ContextNeed[]> = {
    MINIMAL: ["rag"],
    STANDARD: ["rag", "scratchpad", "background"],
    FULL: ["rag", "scratchpad", "active-session", "background"],
};

const PROFILE_ORDER: ContextProfile[] = ["MINIMAL", "STANDARD", "FULL"];

/** The always-safe decision: inject everything (today's behavior). */
export const FULL_DECISION: RouterDecision = {
    intent: "mission-step",
    profile: "FULL",
    needs: PROFILE_NEEDS.FULL,
    route: "commander",
    confidence: 1,
    source: "fallback",
};

/** Whether the router is enabled (one-switch rollback). */
export function isRouterEnabled(): boolean {
    return process.env.ORCHESTRATOR_ROUTER_DISABLED !== "1";
}

// NOTE: JS `\b` is ASCII-only, so Korean keywords cannot use word boundaries —
// they are matched as plain substrings via a separate pattern per signal.
const CODE_SIGNAL_ASCII =
    /(\.[a-z]{1,4}\b|\/[\w.-]+|```|^\s*(diff|---|\+\+\+)|\b(function|class|import|const|export|return)\b|\b(fix|implement|refactor|bug|debug|patch)\b)/im;
const CODE_SIGNAL_KO = /(수정|구현|고쳐|고치|리팩|버그|디버그|코드|파일)/;

const PLAN_SIGNAL_ASCII = /\b(plan|design|architect|architecture|compare|structure|approach|strategy)\b/i;
const PLAN_SIGNAL_KO = /(계획|설계|구조|비교|방향|전략)/;

const QUESTION_SIGNAL_ASCII = /(\?|\b(what|why|how|when|where|which|who)\b)/i;
const QUESTION_SIGNAL_KO = /(뭐|왜|어때|어떻게|알려줘|설명|무엇|인가요|할까)/;

function hasCodeSignal(text: string): boolean {
    return CODE_SIGNAL_ASCII.test(text) || CODE_SIGNAL_KO.test(text);
}
function hasPlanSignal(text: string): boolean {
    return PLAN_SIGNAL_ASCII.test(text) || PLAN_SIGNAL_KO.test(text);
}
function hasQuestionSignal(text: string): boolean {
    return QUESTION_SIGNAL_ASCII.test(text) || QUESTION_SIGNAL_KO.test(text);
}

function escalate(profile: ContextProfile): ContextProfile {
    const idx = PROFILE_ORDER.indexOf(profile);
    return PROFILE_ORDER[Math.min(idx + 1, PROFILE_ORDER.length - 1)];
}

function decide(
    intent: Intent,
    profile: ContextProfile,
    confidence: number,
    source: RouterDecision["source"] = "rule",
): RouterDecision {
    // Decision 3: low confidence is treated as doubt → escalate one tier.
    const finalProfile =
        confidence < ROUTER_CONFIG.confidenceThreshold ? escalate(profile) : profile;
    return {
        intent,
        profile: finalProfile,
        needs: PROFILE_NEEDS[finalProfile],
        route: "commander",
        confidence,
        source,
    };
}

/**
 * Classify a user turn into a context decision. Pure and deterministic.
 * First matching rule wins (see plan §5).
 */
export function classifyIntent(prompt: string, signals: RouterSignals): RouterDecision {
    const text = (prompt ?? "").trim();
    const hasCode = hasCodeSignal(text);
    const hasPlan = hasPlanSignal(text);
    const isQuestion = hasQuestionSignal(text);
    const isShort = text.length <= ROUTER_CONFIG.shortPromptThreshold;

    // 1) Slash command — explicit, high-intent, never reduce.
    if (signals.isSlashCommand) {
        return decide(signals.missionActive ? "mission-step" : "code-edit", "FULL", 0.95);
    }

    // 2) Mission active — core identity always present; floor at STANDARD.
    if (signals.missionActive) {
        if (hasCode || signals.sessionActive) {
            return decide("mission-step", "FULL", 0.9);
        }
        if (isShort && isQuestion) {
            return decide("simple-qa", "STANDARD", 0.7);
        }
        return decide("mission-step", "STANDARD", 0.75);
    }

    // 3) No mission active.
    if (hasCode) {
        return decide("code-edit", "FULL", 0.85);
    }
    if (hasPlan) {
        return decide("planning", "STANDARD", 0.7);
    }
    if (isShort && isQuestion) {
        return decide("simple-qa", "MINIMAL", 0.8);
    }
    return decide("planning", "STANDARD", 0.6);
}

// --- Consume-once decision store (crosses chat.message → system.transform) ---

const pendingDecisions = new Map<string, RouterDecision>();

/**
 * Upper bound on un-consumed decisions. A decision is normally consumed on the
 * next system-transform; this cap only guards against sessions that set one and
 * never reach system-transform, so the map can never grow without bound.
 */
const MAX_PENDING_DECISIONS = 1024;

/** Store the routing decision for the next system-transform of this session. */
export function setRouterDecision(sessionID: string, decision: RouterDecision): void {
    if (!sessionID) return;
    // Re-inserting moves the key to the most-recent position (Map keeps order).
    pendingDecisions.delete(sessionID);
    pendingDecisions.set(sessionID, decision);
    // Evict the oldest un-consumed entries if we somehow exceed the cap.
    while (pendingDecisions.size > MAX_PENDING_DECISIONS) {
        const oldest = pendingDecisions.keys().next().value;
        if (oldest === undefined) break;
        pendingDecisions.delete(oldest);
    }
}

/**
 * Pop the pending decision for this session. Returns null when none is pending
 * (e.g. a mission auto-continuation turn) so callers fall back to FULL.
 */
export function consumeRouterDecision(sessionID: string): RouterDecision | null {
    if (!sessionID) return null;
    const decision = pendingDecisions.get(sessionID) ?? null;
    if (decision) pendingDecisions.delete(sessionID);
    return decision;
}

/** Test/maintenance helper: drop any pending decision for a session. */
export function clearRouterDecision(sessionID: string): void {
    pendingDecisions.delete(sessionID);
}
