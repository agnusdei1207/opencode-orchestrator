import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PATHS } from "../../shared/index.js";
import { getMissionRuntimeOptions } from "./mission-runtime-options.js";
import { isRecord } from "../../shared/core/guards.js";

type MissionLedgerEventType =
    | "mission_started"
    | "verification_failed"
    | "continuation_scheduled"
    | "prompt_injected"
    | "mission_completed"
    | "mission_cancelled"
    | "circuit_open";

export interface MissionLedgerEvent {
    id: string;
    type: MissionLedgerEventType;
    timestamp: string;
    sessionID: string;
    iteration?: number;
    objective?: string;
    summary?: string;
    reason?: string;
}

type MissionLedgerInput = Omit<MissionLedgerEvent, "id" | "timestamp"> & {
    timestamp?: string;
};

const LEDGER_FILE = "mission-ledger.jsonl";
/** Events kept on disk; readers need at most `maxEvidenceEvents` (default 20). */
const LEDGER_RETAINED_EVENTS = 100;
const LEDGER_EVENT_TYPES = new Set<MissionLedgerEventType>([
    "mission_started",
    "verification_failed",
    "continuation_scheduled",
    "prompt_injected",
    "mission_completed",
    "mission_cancelled",
    "circuit_open",
]);

function isLedgerEventType(value: unknown): value is MissionLedgerEventType {
    return typeof value === "string" && LEDGER_EVENT_TYPES.has(value as MissionLedgerEventType);
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === "string";
}

function isOptionalInteger(value: unknown): value is number | undefined {
    return value === undefined || (typeof value === "number" && Number.isInteger(value));
}

export function getMissionLedgerPath(directory: string): string {
    return join(directory, PATHS.OPENCODE, LEDGER_FILE);
}

export function appendMissionLedgerEvent(directory: string, input: MissionLedgerInput): MissionLedgerEvent | null {
    if (!getMissionRuntimeOptions(directory).ledger) return null;

    const event: MissionLedgerEvent = {
        id: randomUUID(),
        timestamp: input.timestamp ?? new Date().toISOString(),
        type: input.type,
        sessionID: input.sessionID,
        iteration: input.iteration,
        objective: input.objective,
        summary: input.summary,
        reason: input.reason,
    };

    try {
        const ledgerPath = getMissionLedgerPath(directory);
        mkdirSync(join(directory, PATHS.OPENCODE), { recursive: true });
        appendFileSync(ledgerPath, `${JSON.stringify(event)}\n`, "utf8");
        trimLedger(ledgerPath);
        return event;
    } catch {
        return null;
    }
}

/**
 * Keep the ledger bounded. Readers use at most `maxEvidenceEvents` lines, so
 * only a short trail beyond that is retained.
 */
function trimLedger(ledgerPath: string): void {
    const lines = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length <= LEDGER_RETAINED_EVENTS) return;
    writeFileSync(ledgerPath, `${lines.slice(-LEDGER_RETAINED_EVENTS).join("\n")}\n`, "utf8");
}

export function readMissionLedger(directory: string, limit = 20): MissionLedgerEvent[] {
    const options = getMissionRuntimeOptions(directory);
    if (!options.ledger) return [];

    const ledgerPath = getMissionLedgerPath(directory);
    if (!existsSync(ledgerPath)) return [];

    try {
        const lines = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean);
        const maxEvents = Math.max(1, Math.min(limit, options.maxEvidenceEvents));
        return lines
            .slice(Math.max(0, lines.length - maxEvents))
            .map(parseLedgerLine)
            .filter((event): event is MissionLedgerEvent => event !== null);
    } catch {
        return [];
    }
}

type LedgerEventRecord = Record<string, unknown> & MissionLedgerEvent;

function hasRequiredLedgerFields(value: Record<string, unknown>): boolean {
    return typeof value.id === "string" &&
        isLedgerEventType(value.type) &&
        typeof value.timestamp === "string" &&
        typeof value.sessionID === "string";
}

function hasValidOptionalLedgerFields(value: Record<string, unknown>): boolean {
    return isOptionalInteger(value.iteration) &&
        isOptionalString(value.objective) &&
        isOptionalString(value.summary) &&
        isOptionalString(value.reason);
}

function isLedgerEventRecord(value: unknown): value is LedgerEventRecord {
    return isRecord(value) && hasRequiredLedgerFields(value) && hasValidOptionalLedgerFields(value);
}

function parseLedgerLine(line: string): MissionLedgerEvent | null {
    try {
        const value: unknown = JSON.parse(line);
        if (!isLedgerEventRecord(value)) return null;

        const event: MissionLedgerEvent = {
            id: value.id,
            type: value.type,
            timestamp: value.timestamp,
            sessionID: value.sessionID,
        };
        if (value.iteration !== undefined) event.iteration = value.iteration;
        if (value.objective !== undefined) event.objective = value.objective;
        if (value.summary !== undefined) event.summary = value.summary;
        if (value.reason !== undefined) event.reason = value.reason;
        return event;
    } catch {
        return null;
    }
}
