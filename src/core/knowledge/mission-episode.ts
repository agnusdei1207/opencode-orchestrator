import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MissionLoopState } from "../../shared/loop/types.js";
import type { MissionLedgerEvent } from "../loop/mission-ledger.js";
import { parseFrontmatter, type FrontmatterData } from "./mission-memory.js";

const EPISODE_DECAY_LAMBDA = 0.07;
const EPISODE_IMPORTANCE = 0.75;
const MAX_EPISODE_EVENTS = 12;

export function syncMissionEpisodeMemory(
    notesDir: string,
    state: MissionLoopState,
    events: MissionLedgerEvent[],
): string | null {
    if (!isCompletedMissionState(state)) return null;

    const objective = state.objective ?? state.prompt;
    const episodeKey = buildEpisodeKey(objective);
    const notePath = join(notesDir, `episodic-${episodeKey}.md`);
    const existing = loadMetadata(notePath);
    const now = new Date().toISOString();
    const sessionChanged = existing?.session !== state.sessionID;
    const count = readCount(existing?.episode_count) + (sessionChanged ? 1 : 0);
    const successCount = readCount(existing?.success_count) + (sessionChanged ? 1 : 0);

    atomicWrite(notePath, buildEpisodeContent({
        state,
        events: eventsForSession(events, state.sessionID),
        objective,
        episodeKey,
        existing,
        now,
        count: Math.max(1, count),
        successCount: Math.max(1, successCount),
    }));
    return notePath;
}

function isCompletedMissionState(state: MissionLoopState): boolean {
    return state.active === false && state.lastContinuationReason === "mission_completed";
}

function buildEpisodeContent(input: {
    state: MissionLoopState;
    events: MissionLedgerEvent[];
    objective: string;
    episodeKey: string;
    existing?: FrontmatterData | null;
    now: string;
    count: number;
    successCount: number;
}): string {
    const { state, events, objective, episodeKey, existing, now, count, successCount } = input;
    const completedAt = completionTime(events) ?? now;
    const frontmatter = buildFrontmatter({ state, objective, episodeKey, existing, now, completedAt, count, successCount });
    return [
        ...frontmatter,
        "# Episodic Memory",
        "",
        `Objective: ${objective}`,
        `Outcome: ${state.lastVerificationSummary ?? "Mission verification passed"}`,
        "",
        "## Evidence Trail",
        ...formatEvidenceTrail(events),
        "",
    ].join("\n");
}

function buildFrontmatter(input: {
    state: MissionLoopState;
    objective: string;
    episodeKey: string;
    existing?: FrontmatterData | null;
    now: string;
    completedAt: string;
    count: number;
    successCount: number;
}): string[] {
    const { state, objective, episodeKey, existing, now, completedAt, count, successCount } = input;
    const ingestionTime = stringMeta(existing?.ingestion_time) ?? now;
    const lastAccessed = stringMeta(existing?.last_accessed) ?? now;
    const accessCount = numberMeta(existing?.access_count) ?? 1;
    const memoryLayer = stringMeta(existing?.memory_layer) ?? "warm";
    return [
        "---",
        "tags: [mission-memory, orchestrator, episodic]",
        `title: "${escapeYaml(`episodic memory ${objective}`)}"`,
        'level: "mission"',
        'horizon: "execution"',
        `importance: ${EPISODE_IMPORTANCE}`,
        `session: "${escapeYaml(state.sessionID)}"`,
        `objective: "${escapeYaml(objective)}"`,
        `episode_key: "${episodeKey}"`,
        `episode_count: ${count}`,
        `success_count: ${successCount}`,
        `event_time: "${completedAt}"`,
        `ingestion_time: "${ingestionTime}"`,
        `record_updated_at: "${now}"`,
        `last_accessed: "${lastAccessed}"`,
        `access_count: ${accessCount}`,
        'memory_kind: "episodic"',
        `decay_lambda: ${EPISODE_DECAY_LAMBDA}`,
        `memory_layer: "${memoryLayer}"`,
        "confidence: 1",
        "---",
    ];
}

function eventsForSession(events: MissionLedgerEvent[], sessionID: string): MissionLedgerEvent[] {
    return events
        .filter(event => event.sessionID === sessionID)
        .slice(-MAX_EPISODE_EVENTS);
}

function formatEvidenceTrail(events: MissionLedgerEvent[]): string[] {
    if (events.length === 0) return ["- No ledger evidence was available."];
    return events.map(event => {
        const detail = event.summary ?? event.reason ?? "recorded";
        return `- ${event.timestamp} ${event.type}: ${detail}`;
    });
}

function completionTime(events: MissionLedgerEvent[]): string | null {
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].type === "mission_completed") return events[i].timestamp;
    }
    return null;
}

function loadMetadata(filePath: string): FrontmatterData | null {
    if (!existsSync(filePath)) return null;
    try {
        return parseFrontmatter(readFileSync(filePath, "utf8"));
    } catch {
        return null;
    }
}

function buildEpisodeKey(objective: string): string {
    const safe = objective.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 56);
    const hash = createHash("sha256").update(objective).digest("hex").slice(0, 8);
    return safe ? `${safe}-${hash}` : hash;
}

function readCount(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringMeta(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
}

function numberMeta(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function atomicWrite(path: string, content: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const tempPath = `${path}.tmp`;
    writeFileSync(tempPath, content, "utf8");
    renameSync(tempPath, path);
}

function escapeYaml(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
