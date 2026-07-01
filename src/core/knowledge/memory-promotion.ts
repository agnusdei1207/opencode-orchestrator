import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { SECURITY_PATTERNS } from "../../shared/constants/security-patterns.js";
import { normalizeMemoryKind } from "./memory-kind.js";
import { TagIndexer, type FrontmatterData } from "./tag-indexer.js";

const SEMANTIC_REPEAT_THRESHOLD = 2;
const PROCEDURAL_SUCCESS_THRESHOLD = 2;
const SEMANTIC_DECAY_LAMBDA = 0.018;
const PROCEDURAL_DECAY_LAMBDA = 0.006;

export interface MemoryPromotionResult {
    changedFiles: string[];
    semanticPromotions: string[];
    proceduralPromotions: string[];
}

interface PromotionRecord {
    filePath: string;
    metadata: FrontmatterData;
    body: string;
}

export function promoteEpisodicMemories(filePaths: string[], now: Date = new Date()): MemoryPromotionResult {
    const result: MemoryPromotionResult = {
        changedFiles: [],
        semanticPromotions: [],
        proceduralPromotions: [],
    };

    for (const record of loadEpisodicRecords(filePaths)) {
        promoteRecord(record, now, result);
    }

    result.changedFiles = Array.from(new Set(result.changedFiles)).sort();
    result.semanticPromotions.sort();
    result.proceduralPromotions.sort();
    return result;
}

function promoteRecord(record: PromotionRecord, now: Date, result: MemoryPromotionResult): void {
    const episodeCount = countMeta(record.metadata.episode_count);
    const successCount = countMeta(record.metadata.success_count);
    if (episodeCount >= SEMANTIC_REPEAT_THRESHOLD) {
        const filePath = writePromotion(record, "semantic", now);
        result.changedFiles.push(filePath);
        result.semanticPromotions.push(filePath);
    }
    if (successCount >= PROCEDURAL_SUCCESS_THRESHOLD) {
        const filePath = writePromotion(record, "procedural", now);
        result.changedFiles.push(filePath);
        result.proceduralPromotions.push(filePath);
    }
}

function loadEpisodicRecords(filePaths: string[]): PromotionRecord[] {
    const parser = new TagIndexer();
    return filePaths
        .map(filePath => loadRecord(parser, filePath))
        .filter((record): record is PromotionRecord => record !== null)
        .filter(record => normalizeMemoryKind(record.metadata.memory_kind) === "episodic");
}

function loadRecord(parser: TagIndexer, filePath: string): PromotionRecord | null {
    if (!existsSync(filePath) || !filePath.endsWith(".md")) return null;
    try {
        const { data, body } = parser.parseFrontmatter(readFileSync(filePath, "utf8"));
        return { filePath, metadata: data, body };
    } catch {
        return null;
    }
}

function writePromotion(record: PromotionRecord, kind: "semantic" | "procedural", now: Date): string {
    const episodeKey = stringMeta(record.metadata.episode_key) ?? basename(record.filePath, ".md");
    const filePath = join(dirname(record.filePath), `${kind}-${episodeKey}.md`);
    const content = kind === "semantic"
        ? buildSemanticContent(record, now)
        : buildProceduralContent(record, now);
    atomicWrite(filePath, content);
    return filePath;
}

function buildSemanticContent(record: PromotionRecord, now: Date): string {
    const body = redactPromotionText(record.body, record.metadata);
    return [
        ...promotionFrontmatter(record, "semantic", SEMANTIC_DECAY_LAMBDA, now),
        "# Semantic Memory",
        "",
        `Objective pattern: ${stringMeta(record.metadata.objective) ?? "unknown objective"}`,
        `Observed successful repetitions: ${countMeta(record.metadata.success_count)}`,
        "",
        "## Generalized Evidence",
        body,
        "",
    ].join("\n");
}

function buildProceduralContent(record: PromotionRecord, now: Date): string {
    const body = redactPromotionText(record.body, record.metadata);
    return [
        ...promotionFrontmatter(record, "procedural", PROCEDURAL_DECAY_LAMBDA, now),
        "# Procedural Memory",
        "",
        "## Prerequisites",
        `- Objective resembles: ${stringMeta(record.metadata.objective) ?? "the promoted episode objective"}`,
        "",
        "## Commands",
        ...extractProcedureSteps(body),
        "",
        "## Verification",
        "- Re-run the current repository's relevant build, type, and test checks.",
        "- Compare producer fields, consumer inputs, and generated artifacts before completion.",
        "",
        "## Failure Pivots",
        "- If verification fails, inspect the ledger evidence and reduce the next step size.",
        "- If evidence is missing, stop promotion-derived assumptions and reopen the source files.",
        "",
    ].join("\n");
}

function promotionFrontmatter(
    record: PromotionRecord,
    kind: "semantic" | "procedural",
    decayLambda: number,
    now: Date,
): string[] {
    const timestamp = now.toISOString();
    const episodeKey = stringMeta(record.metadata.episode_key) ?? basename(record.filePath, ".md");
    return [
        "---",
        `tags: [mission-memory, orchestrator, ${kind}]`,
        `title: "${escapeYaml(`${kind} memory ${episodeKey}`)}"`,
        `memory_kind: "${kind}"`,
        `decay_lambda: ${decayLambda}`,
        'memory_layer: "warm"',
        "importance: 0.82",
        "confidence: 0.8",
        'privacy_class: "internal"',
        `promotion_source: "${escapeYaml(record.filePath)}"`,
        `episode_key: "${episodeKey}"`,
        `event_time: "${stringMeta(record.metadata.event_time) ?? timestamp}"`,
        `ingestion_time: "${timestamp}"`,
        `record_updated_at: "${timestamp}"`,
        "access_count: 1",
        "---",
    ];
}

function extractProcedureSteps(body: string): string[] {
    const eventLines = body.split(/\r?\n/).filter(line => line.trim().startsWith("- "));
    if (eventLines.length === 0) return ["- Replay the successful sequence only after verifying it against current files."];
    return eventLines.slice(0, 6).map(line => `- ${line.replace(/^-\s*/, "")}`);
}

export function redactPromotionText(value: string, metadata?: FrontmatterData): string {
    let redacted = value;
    for (const pattern of SECURITY_PATTERNS.SECRETS) {
        redacted = redacted.replace(new RegExp(pattern.source, pattern.flags), "[REDACTED_SECRET]");
    }
    redacted = redacted.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z\b/g, "[REDACTED_TIMESTAMP]");
    const session = stringMeta(metadata?.session);
    return session ? redacted.split(session).join("[REDACTED_SESSION]") : redacted;
}

function countMeta(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringMeta(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
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
