import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { FrontmatterData } from "./tag-indexer.js";
import { TagIndexer } from "./tag-indexer.js";

export type MemoryLayer = "hot" | "warm" | "cold" | "archive";

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

const KIND_DECAY: Record<string, number> = {
    sop: 0.006,
    workflow: 0.01,
    fact: 0.018,
    preference: 0.02,
    gotcha: 0.03,
    episode: 0.07,
};

const LAYER_THRESHOLDS: Array<[MemoryLayer, number]> = [
    ["hot", 0.75],
    ["warm", 0.35],
    ["cold", 0.08],
    ["archive", 0],
];

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
        if (!record || !this.hasMemoryMetadata(record.metadata)) return false;

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
            if (!record || !this.hasMemoryMetadata(record.metadata)) continue;
            if (record.metadata.keep === true) {
                protectedFiles.push(filePath);
                continue;
            }

            const strength = this.memoryStrength(record.metadata, now.getTime());
            const to = this.layerForStrength(strength);
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
            .filter((record): record is MemoryLifecycleRecord => record !== null && this.hasMemoryMetadata(record.metadata));
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

    public memoryStrength(metadata: FrontmatterData, now = Date.now()): number {
        if (metadata.keep === true) return 1;
        if (metadata.memory_layer === "archive") return 0;
        if (!this.hasMemoryMetadata(metadata)) return 1;

        const lastSeen = timestampMillis(metadata.last_accessed ?? metadata.ingestion_time) ?? now;
        const ageDays = Math.max(0, (now - lastSeen) / 86_400_000);
        const lambda = numberOr(metadata.decay_lambda, KIND_DECAY[metadata.memory_kind ?? "fact"] ?? 0.03);
        const access = numberOr(metadata.access_ema, numberOr(metadata.access_count, 0));
        const quality = Math.max(0.1, numberOr(metadata.importance, 1) * numberOr(metadata.confidence, 1));
        const reinforcement = 1 + Math.log1p(access) / 4;
        const expiry = this.isExpired(metadata.valid_to, now) ? 0.35 : 1;
        return clamp(quality * reinforcement * Math.exp(-lambda * ageDays) * expiry, 0.05, 1);
    }

    private hasMemoryMetadata(metadata: FrontmatterData): boolean {
        return [
            metadata.event_time,
            metadata.ingestion_time,
            metadata.last_accessed,
            metadata.valid_to,
            metadata.decay_lambda,
            metadata.access_count,
            metadata.access_ema,
            metadata.importance,
            metadata.confidence,
            metadata.memory_kind,
            metadata.memory_layer,
            metadata.valid_from,
            metadata.supersedes,
        ].some(value => value !== undefined && value !== null);
    }

    private layerForStrength(strength: number): MemoryLayer {
        for (const [layer, threshold] of LAYER_THRESHOLDS) {
            if (strength >= threshold) return layer;
        }
        return "archive";
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

    private isExpired(validTo: unknown, now: number): boolean {
        const expiresAt = timestampMillis(validTo);
        return expiresAt !== null && expiresAt < now;
    }

    private writeRecord(filePath: string, metadata: FrontmatterData, body: string): void {
        mkdirSync(dirname(filePath), { recursive: true });
        const content = `${serializeFrontmatter(metadata)}\n${body.trimStart()}`;
        const tempPath = `${filePath}.tmp`;
        writeFileSync(tempPath, content, "utf8");
        renameSync(tempPath, filePath);
    }
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

function numberOr(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOr(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

function timestampMillis(value: unknown): number | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
