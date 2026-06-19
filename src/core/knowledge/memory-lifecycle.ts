import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { FrontmatterData } from "./tag-indexer.js";
import { TagIndexer } from "./tag-indexer.js";
import {
    hasMemoryMetadata,
    layerForStrength,
    memoryStrength,
    numberOr,
} from "./memory-scoring.js";
import type { MemoryLayer } from "./memory-scoring.js";

export type { MemoryLayer } from "./memory-scoring.js";

export interface MemoryLifecycleRecord {
    filePath: string;
    metadata: FrontmatterData;
    body: string;
}

export interface MemoryTierDecision {
    filePath: string;
    from: MemoryLayer | undefined;
    to: MemoryLayer;
    strength: number;
}

export interface MemoryLifecyclePlan {
    tierChanges: MemoryTierDecision[];
    archiveCandidates: MemoryTierDecision[];
    protectedFiles: string[];
}

export interface TemporalSupersession {
    supersededFile: string;
    supersedingFile: string;
    validTo: string;
    supersedesId: string;
}

export class MemoryLifecycle {
    private readonly parser = new TagIndexer();

    public loadRecord(filePath: string): MemoryLifecycleRecord | null {
        if (!existsSync(filePath) || !filePath.endsWith(".md")) return null;
        const raw = readFileSync(filePath, "utf8");
        const { data, body } = this.parser.parseFrontmatter(raw);
        return { filePath, metadata: data, body };
    }

    public recordAccess(filePath: string, now: Date = new Date()): boolean {
        const record = this.loadRecord(filePath);
        if (!record || !hasMemoryMetadata(record.metadata)) return false;

        const count = numberOr(record.metadata.access_count, 0) + 1;
        const previousEma = numberOr(record.metadata.access_ema, count - 1);
        const nextEma = (previousEma * 0.75) + 0.25;
        const timestamp = now.toISOString();

        this.writeRecord(filePath, {
            ...record.metadata,
            access_count: count,
            access_ema: Number(nextEma.toFixed(4)),
            last_accessed: timestamp,
            record_updated_at: timestamp,
        }, record.body);
        return true;
    }

    public planLifecycle(filePaths: string[], now: Date = new Date()): MemoryLifecyclePlan {
        const tierChanges: MemoryTierDecision[] = [];
        const archiveCandidates: MemoryTierDecision[] = [];
        const protectedFiles: string[] = [];

        for (const filePath of filePaths) {
            const record = this.loadRecord(filePath);
            if (!record || !hasMemoryMetadata(record.metadata)) continue;
            if (record.metadata.keep === true) {
                protectedFiles.push(filePath);
                continue;
            }

            const strength = memoryStrength(record.metadata, now.getTime());
            const to = layerForStrength(strength);
            const from = this.parseLayer(record.metadata.memory_layer);
            if (from !== to) {
                const decision = { filePath, from, to, strength };
                tierChanges.push(decision);
                if (to === "archive") archiveCandidates.push(decision);
            }
        }

        tierChanges.sort((a, b) => a.filePath.localeCompare(b.filePath));
        archiveCandidates.sort((a, b) => a.filePath.localeCompare(b.filePath));
        protectedFiles.sort();
        return { tierChanges, archiveCandidates, protectedFiles };
    }

    public applyLifecyclePlan(root: string, plan: MemoryLifecyclePlan, applyArchives = false, now: Date = new Date()): string[] {
        const changed: string[] = [];
        for (const decision of plan.tierChanges) {
            const record = this.loadRecord(decision.filePath);
            if (!record) continue;
            const timestamp = now.toISOString();
            this.writeRecord(decision.filePath, {
                ...record.metadata,
                memory_layer: decision.to,
                tombstone: decision.to === "archive" ? true : record.metadata.tombstone,
                record_updated_at: timestamp,
            }, record.body);
            changed.push(decision.filePath);
        }

        if (!applyArchives) return changed.sort();

        const archiveDir = join(root, "archive", "memory");
        mkdirSync(archiveDir, { recursive: true });
        for (const decision of plan.archiveCandidates) {
            if (!existsSync(decision.filePath)) continue;
            const target = join(archiveDir, basename(decision.filePath));
            renameSync(decision.filePath, target);
            changed.push(target);
        }
        return changed.sort();
    }

    public resolveTemporalSupersessions(filePaths: string[], now: Date = new Date()): TemporalSupersession[] {
        const records = filePaths
            .map(filePath => this.loadRecord(filePath))
            .filter((record): record is MemoryLifecycleRecord => record !== null && hasMemoryMetadata(record.metadata));
        const groups = new Map<string, MemoryLifecycleRecord[]>();
        for (const record of records) {
            const key = this.identityKey(record);
            if (!key) continue;
            const group = groups.get(key) ?? [];
            group.push(record);
            groups.set(key, group);
        }

        const supersessions: TemporalSupersession[] = [];
        for (const group of groups.values()) {
            const ordered = group
                .filter(record => !record.metadata.valid_to)
                .sort((a, b) => this.recordTime(a).localeCompare(this.recordTime(b)));
            for (let i = 0; i < ordered.length - 1; i++) {
                const oldRecord = ordered[i];
                const newRecord = ordered[i + 1];
                const validTo = newRecord.metadata.valid_from ?? newRecord.metadata.event_time ?? newRecord.metadata.ingestion_time ?? now.toISOString();
                const supersedesId = this.recordId(oldRecord);
                this.writeRecord(oldRecord.filePath, {
                    ...oldRecord.metadata,
                    valid_to: validTo,
                    memory_layer: "archive",
                    tombstone: true,
                    record_updated_at: now.toISOString(),
                }, oldRecord.body);
                const nextSupersedes = new Set([...(newRecord.metadata.supersedes ?? []), supersedesId]);
                this.writeRecord(newRecord.filePath, {
                    ...newRecord.metadata,
                    supersedes: Array.from(nextSupersedes).sort(),
                    record_updated_at: now.toISOString(),
                }, newRecord.body);
                supersessions.push({
                    supersededFile: oldRecord.filePath,
                    supersedingFile: newRecord.filePath,
                    validTo,
                    supersedesId,
                });
            }
        }
        return supersessions.sort((a, b) => a.supersededFile.localeCompare(b.supersededFile));
    }

    private parseLayer(value: unknown): MemoryLayer | undefined {
        return value === "hot" || value === "warm" || value === "cold" || value === "archive"
            ? value
            : undefined;
    }

    private identityKey(record: MemoryLifecycleRecord): string | null {
        const metadata = record.metadata;
        const explicit = stringOr(metadata.memory_id) ?? stringOr(metadata.source_hash);
        if (explicit) return explicit;
        const title = stringOr(metadata.title);
        return title ? `title:${title.toLowerCase()}` : null;
    }

    private recordId(record: MemoryLifecycleRecord): string {
        return stringOr(record.metadata.memory_id)
            ?? stringOr(record.metadata.source_hash)
            ?? stringOr(record.metadata.title)
            ?? basename(record.filePath, ".md");
    }

    private recordTime(record: MemoryLifecycleRecord): string {
        return stringOr(record.metadata.event_time)
            ?? stringOr(record.metadata.ingestion_time)
            ?? "";
    }

    private writeRecord(filePath: string, metadata: FrontmatterData, body: string): void {
        mkdirSync(dirname(filePath), { recursive: true });
        const content = `${serializeFrontmatter(metadata)}\n${body.trimStart()}`;
        const tempPath = `${filePath}.tmp`;
        writeFileSync(tempPath, content, "utf8");
        renameSync(tempPath, filePath);
    }
}

export interface MemoryMaintenanceOptions {
    /** Repository root used to resolve the archive destination directory. */
    root: string;
    /** Memory note file paths to evaluate. */
    filePaths: string[];
    /**
     * When true (the DEFAULT), nothing is written or moved: the computed plan is
     * returned for inspection. Pass `dryRun: false` to actually apply tier
     * changes, archive moves, and temporal supersessions to disk.
     */
    dryRun?: boolean;
    /** When applying, also physically move archive candidates into archive/memory. */
    applyArchives?: boolean;
    /** Injectable clock for deterministic runs (defaults to now). */
    now?: Date;
}

export interface MemoryMaintenanceResult {
    dryRun: boolean;
    plan: MemoryLifecyclePlan;
    changedFiles: string[];
    supersessions: TemporalSupersession[];
}

/**
 * Manual / opt-in memory maintenance entry point.
 *
 * This is the ONLY supported way to run the destructive lifecycle operations
 * (tier moves, archiving, tombstone supersession). It is deliberately NOT wired
 * into any search or index path — those must never mutate memory on disk.
 *
 * Defaults to `dryRun: true`, returning the plan without touching files. Call
 * with `dryRun: false` to apply. Invoke from a CLI/maintenance task only.
 *
 * Tip: gate any auto-scheduling of this behind `OPENCODE_MEMORY_MAINTENANCE`.
 */
export function runMemoryMaintenance(options: MemoryMaintenanceOptions): MemoryMaintenanceResult {
    const { root, filePaths, applyArchives = false } = options;
    const dryRun = options.dryRun ?? true;
    const now = options.now ?? new Date();
    const lifecycle = new MemoryLifecycle();

    const plan = lifecycle.planLifecycle(filePaths, now);
    if (dryRun) {
        return { dryRun: true, plan, changedFiles: [], supersessions: [] };
    }

    const changedFiles = lifecycle.applyLifecyclePlan(root, plan, applyArchives, now);
    const supersessions = lifecycle.resolveTemporalSupersessions(filePaths, now);
    return { dryRun: false, plan, changedFiles, supersessions };
}

function serializeFrontmatter(metadata: FrontmatterData): string {
    const lines = ["---"];
    for (const key of Object.keys(metadata).sort()) {
        const value = metadata[key];
        if (value === undefined) continue;
        lines.push(`${key}: ${formatYamlValue(value)}`);
    }
    lines.push("---");
    return lines.join("\n");
}

function formatYamlValue(value: unknown): string {
    if (value === null) return "null";
    if (typeof value === "boolean" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return `[${value.map(item => String(item)).join(", ")}]`;
    const text = String(value);
    return /^[A-Za-z0-9_./:@+-]+$/.test(text) ? text : JSON.stringify(text);
}

function stringOr(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}
