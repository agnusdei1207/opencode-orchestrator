import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PATHS } from "../../shared/index.js";
import type { MissionLoopState } from "../../shared/loop/interfaces/mission-loop.js";
import { readMissionLedger, type MissionLedgerEvent } from "../loop/mission-ledger.js";
import { getMissionRuntimeOptions } from "../loop/mission-runtime-options.js";

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
const MAX_CANVAS_EVENTS = 3;
const MAX_SCRATCHPAD_EVENTS = 6;

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
