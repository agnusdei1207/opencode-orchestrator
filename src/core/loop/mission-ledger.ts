import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PATHS } from "../../shared/index.js";
import { getMissionRuntimeOptions } from "./mission-runtime-options.js";

export type MissionLedgerEventType =
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

export type MissionLedgerInput = Omit<MissionLedgerEvent, "id" | "timestamp"> & {
    timestamp?: string;
};

const LEDGER_FILE = "mission-ledger.jsonl";
const LEDGER_EVENT_TYPES = new Set<MissionLedgerEventType>([
    "mission_started",
    "verification_failed",
    "continuation_scheduled",
    "prompt_injected",
    "mission_completed",
    "mission_cancelled",
    "circuit_open",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
    if (!getMissionRuntimeOptions().ledger) return null;

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
        return event;
    } catch {
        return null;
    }
}

export function readMissionLedger(directory: string, limit = 20): MissionLedgerEvent[] {
    const options = getMissionRuntimeOptions();
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

function parseLedgerLine(line: string): MissionLedgerEvent | null {
    try {
        const value = JSON.parse(line);
        if (!isRecord(value)) return null;
        if (typeof value.id !== "string") return null;
        if (!isLedgerEventType(value.type)) return null;
        if (typeof value.timestamp !== "string") return null;
        if (typeof value.sessionID !== "string") return null;
        if (!isOptionalInteger(value.iteration)) return null;
        if (!isOptionalString(value.objective)) return null;
        if (!isOptionalString(value.summary)) return null;
        if (!isOptionalString(value.reason)) return null;

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
