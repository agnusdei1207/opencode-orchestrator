import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface FrontmatterData {
    tags?: string[];
    title?: string;
    keep?: boolean;
    event_time?: string;
    ingestion_time?: string;
    record_updated_at?: string;
    last_accessed?: string;
    access_count?: number;
    access_ema?: number;
    importance?: number;
    confidence?: number;
    decay_lambda?: number;
    memory_kind?: string;
    memory_layer?: string;
    tombstone?: boolean;
    valid_from?: string;
    valid_to?: string | null;
    supersedes?: string[];
    [key: string]: unknown;
}

// Preserve the existing limited syntax: this is not a general YAML decoder.
export function parseFrontmatter(content: string): FrontmatterData {
    const data: FrontmatterData = {};
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return data;
    for (const line of match[1].split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx === -1) continue;
        const key = trimmed.slice(0, colonIdx).trim();
        data[key] = parseFrontmatterValue(trimmed.slice(colonIdx + 1).trim());
    }
    return data;
}

function parseFrontmatterValue(value: string): unknown {
    if (value.startsWith("[") && value.endsWith("]")) {
        return value.slice(1, -1).split(",")
            .map(item => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null" || value === "~") return null;
    if (!Number.isNaN(Number(value)) && value !== "") return Number(value);
    return unquote(value);
}

function unquote(value: string): string {
    const doubleQuoted = value.startsWith('"') && value.endsWith('"');
    const singleQuoted = value.startsWith("'") && value.endsWith("'");
    return doubleQuoted || singleQuoted ? value.slice(1, -1) : value;
}

export function loadNoteMetadata(filePath: string): FrontmatterData | null {
    if (!existsSync(filePath)) return null;
    try {
        return parseFrontmatter(readFileSync(filePath, "utf8"));
    } catch {
        return null;
    }
}

export function stringMeta(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
}

export function numberMeta(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function atomicWrite(path: string, content: string): void {
    mkdirSync(dirname(path), { recursive: true });
    const tempPath = `${path}.tmp`;
    writeFileSync(tempPath, content, "utf8");
    renameSync(tempPath, path);
}

export function escapeYaml(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
