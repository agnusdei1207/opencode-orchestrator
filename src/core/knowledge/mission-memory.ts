import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PATHS } from "../../shared/index.js";
import type { MissionLoopState } from "../../shared/loop/types.js";
import { readMissionLedger, type MissionLedgerEvent } from "../loop/mission-ledger.js";
import { getMissionRuntimeOptions } from "../loop/mission-runtime-options.js";
import { MemoryLevel, type MemoryEntry } from "../memory/interfaces.js";
import { MemoryManager } from "../memory/memory-manager.js";

interface CanvasNode {
    id: string;
    type: "text";
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

interface CanvasEdge {
    id: string;
    fromNode: string;
    toNode: string;
    label?: string;
}

const BRAIN_DIR = join(PATHS.DOCS, "brain");
const SCRATCHPAD_FILE = "scratchpad.md";
const CANVAS_FILE = "knowledge-map.canvas";
const MEMORY_NOTES_DIR = "memories";
const MAX_CANVAS_EVENTS = 3;
const MAX_SCRATCHPAD_EVENTS = 6;
const MAX_MEMORY_NOTES = 8;
const MAX_MEMORY_BODY_CHARS = 900;
const SCRATCHPAD_SNAPSHOT_CHARS = 1600;
const MISSION_MEMORY_LEVELS: readonly MemoryLevel[] = [
    MemoryLevel.PROJECT,
    MemoryLevel.MISSION,
    MemoryLevel.TASK,
];

export function syncMissionMemory(directory: string, state: MissionLoopState): boolean {
    const options = getMissionRuntimeOptions();
    if (!options.markdownMemory) return false;

    const events = readMissionLedger(
        directory,
        Math.min(MAX_SCRATCHPAD_EVENTS, options.maxEvidenceEvents),
    );
    try {
        writeScratchpad(directory, state, events);
        writeCanvas(directory, state, events);
        syncMissionMemoryNotes(directory, state);
        return true;
    } catch {
        return false;
    }
}

export function getMissionScratchpadPath(directory: string): string {
    return join(directory, BRAIN_DIR, SCRATCHPAD_FILE);
}

export function getMissionCanvasPath(directory: string): string {
    return join(directory, BRAIN_DIR, CANVAS_FILE);
}

export function getMissionMemoryNotesDirPath(directory: string): string {
    return join(directory, BRAIN_DIR, MEMORY_NOTES_DIR);
}

export function readMissionScratchpadSnapshot(directory: string, maxChars = SCRATCHPAD_SNAPSHOT_CHARS): string | null {
    const path = getMissionScratchpadPath(directory);
    if (!existsSync(path)) return null;

    const content = stripFrontmatter(readFileSync(path, "utf8")).trim();
    if (!content) return null;
    if (content.length <= maxChars) return content;
    return `${content.slice(0, maxChars)}...`;
}

function writeScratchpad(directory: string, state: MissionLoopState, events: MissionLedgerEvent[]): void {
    const content = [
        "---",
        "tags: [scratchpad, mission, orchestrator]",
        "keep: true",
        `title: "${escapeYaml(state.objective ?? "Active Mission")}"`,
        "---",
        "# Orchestrator Mission Scratchpad",
        "",
        "## Focus",
        `- Objective: ${state.objective ?? state.prompt}`,
        `- Session: ${state.sessionID}`,
        `- Status: ${state.active ? "active" : "inactive"}`,
        `- Iteration: ${state.iteration}/${state.maxIterations}`,
        "",
        "## Runtime State",
        `- Last progress: ${state.lastProgress ?? "unknown"}`,
        `- Last verification: ${state.lastVerificationSummary ?? "unknown"}`,
        `- Last continuation reason: ${state.lastContinuationReason ?? "unknown"}`,
        "",
        "## Recent Evidence",
        ...formatEventLines(events),
        "",
        "## Open Questions",
        "- Keep this section short; unresolved blockers should be reflected in TODO or sync issues.",
        "",
    ].join("\n");

    atomicWrite(getMissionScratchpadPath(directory), content);
}

function writeCanvas(directory: string, state: MissionLoopState, events: MissionLedgerEvent[]): void {
    const nodes = buildCanvasNodes(state, events);
    const edges = buildCanvasEdges(nodes);
    atomicWrite(getMissionCanvasPath(directory), JSON.stringify({ nodes, edges }, null, 2));
}

function syncMissionMemoryNotes(directory: string, state: MissionLoopState): void {
    const notesDir = getMissionMemoryNotesDirPath(directory);
    const expectedFiles = new Set<string>();

    for (const entry of selectMissionMemoryEntries(state)) {
        const fileName = buildMemoryNoteFileName(entry);
        expectedFiles.add(fileName);
        atomicWrite(join(notesDir, fileName), buildMemoryNoteContent(state, entry));
    }

    if (!existsSync(notesDir)) return;

    for (const entry of readdirSync(notesDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        if (!expectedFiles.has(entry.name)) {
            unlinkSync(join(notesDir, entry.name));
        }
    }
}

function buildCanvasNodes(state: MissionLoopState, events: MissionLedgerEvent[]): CanvasNode[] {
    const nodes: CanvasNode[] = [
        textNode("objective", `Objective\n${state.objective ?? state.prompt}`, 0, 0),
        textNode("runtime", `Runtime\nIteration ${state.iteration}/${state.maxIterations}\nProgress ${state.lastProgress ?? "unknown"}`, 420, 0),
        textNode("verification", `Verification\n${state.lastVerificationSummary ?? "unknown"}`, 840, 0),
    ];

    events.slice(-MAX_CANVAS_EVENTS).forEach((event, index) => {
        nodes.push(textNode(`event-${index}`, `${event.type}\n${event.summary ?? event.reason ?? event.timestamp}`, 420 * index, 260));
    });
    return nodes;
}

function buildCanvasEdges(nodes: CanvasNode[]): CanvasEdge[] {
    const edges: CanvasEdge[] = [
        { id: "objective-runtime", fromNode: "objective", toNode: "runtime", label: "drives" },
        { id: "runtime-verification", fromNode: "runtime", toNode: "verification", label: "checks" },
    ];

    for (const node of nodes.filter(item => item.id.startsWith("event-"))) {
        edges.push({ id: `verification-${node.id}`, fromNode: "verification", toNode: node.id, label: "evidence" });
    }
    return edges;
}

function textNode(id: string, text: string, x: number, y: number): CanvasNode {
    return { id, type: "text", text, x, y, width: 360, height: 180 };
}

function selectMissionMemoryEntries(state: MissionLoopState): MemoryEntry[] {
    const snapshot = MemoryManager.getInstance().export();
    const query = `${state.objective ?? ""} ${state.prompt}`.trim();
    const selected: MemoryEntry[] = [];

    for (const level of MISSION_MEMORY_LEVELS) {
        const entries = snapshot[level] ?? [];
        for (const entry of entries) {
            if (shouldPersistMissionEntry(entry, level, query)) {
                selected.push(entry);
            }
        }
    }

    return selected
        .sort((left, right) => right.importance - left.importance || right.timestamp - left.timestamp)
        .slice(0, MAX_MEMORY_NOTES);
}

function shouldPersistMissionEntry(entry: MemoryEntry, level: MemoryLevel, query: string): boolean {
    const matchesQuery = query ? isRelevantToQuery(entry.content, query) : false;

    switch (level) {
        case MemoryLevel.PROJECT:
            return entry.importance >= 0.7 || matchesQuery;
        case MemoryLevel.MISSION:
            return entry.importance >= 0.5 || matchesQuery;
        case MemoryLevel.TASK:
            return entry.importance >= 0.7 || matchesQuery;
        default:
            return false;
    }
}

function isRelevantToQuery(content: string, query: string): boolean {
    const normalizedContent = content.toLowerCase();
    const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .map(token => token.trim())
        .filter(token => token.length > 3);

    if (keywords.length === 0) return false;
    return keywords.some(keyword => normalizedContent.includes(keyword));
}

function buildMemoryNoteFileName(entry: MemoryEntry): string {
    return `${entry.level}-${sanitizeFilePart(entry.id)}.md`;
}

function buildMemoryNoteContent(state: MissionLoopState, entry: MemoryEntry): string {
    const recordedAt = new Date(entry.timestamp).toISOString();
    const body = entry.content.length > MAX_MEMORY_BODY_CHARS
        ? `${entry.content.slice(0, MAX_MEMORY_BODY_CHARS)}...`
        : entry.content;

    return [
        "---",
        `tags: [mission-memory, orchestrator, ${entry.level}]`,
        `title: "${escapeYaml(`${entry.level} memory ${entry.id}`)}"`,
        "keep: true",
        `level: "${entry.level}"`,
        `importance: ${entry.importance.toFixed(3)}`,
        `session: "${escapeYaml(state.sessionID)}"`,
        `recorded_at: "${recordedAt}"`,
        `objective: "${escapeYaml(state.objective ?? state.prompt)}"`,
        "---",
        `# ${capitalize(entry.level)} Memory`,
        "",
        `- Session: ${state.sessionID}`,
        `- Recorded at: ${recordedAt}`,
        `- Importance: ${entry.importance.toFixed(3)}`,
        "",
        "## Content",
        body,
        "",
    ].join("\n");
}

function formatEventLines(events: MissionLedgerEvent[]): string[] {
    if (events.length === 0) return ["- No runtime evidence recorded yet."];
    return events.map(event => `- ${event.timestamp} ${event.type}: ${event.summary ?? event.reason ?? "recorded"}`);
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

function stripFrontmatter(content: string): string {
    return content.replace(/^---\n[\s\S]*?\n---\n?/u, "");
}

function sanitizeFilePart(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
