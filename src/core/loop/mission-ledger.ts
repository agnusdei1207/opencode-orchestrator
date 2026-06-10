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
        const value = JSON.parse(line) as Partial<MissionLedgerEvent>;
        if (!value.id || !value.type || !value.timestamp || !value.sessionID) return null;
        return value as MissionLedgerEvent;
    } catch {
        return null;
    }
}
