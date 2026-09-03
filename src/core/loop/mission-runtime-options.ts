export interface MissionRuntimeOptions {
    ledger: boolean;
    markdownMemory: boolean;
    maxEvidenceEvents: number;
    /** Whether to inject Knowledge Graph RAG context into prompts (ADR-0019: default false) */
    enableKnowledgeRag: boolean;
}

export const DEFAULT_MISSION_RUNTIME_OPTIONS: MissionRuntimeOptions = {
    ledger: true,
    markdownMemory: true,
    maxEvidenceEvents: 20,
    enableKnowledgeRag: false,
};

let runtimeOptions: MissionRuntimeOptions = { ...DEFAULT_MISSION_RUNTIME_OPTIONS };

export function configureMissionRuntimeOptions(options: Partial<MissionRuntimeOptions>): void {
    runtimeOptions = { ...DEFAULT_MISSION_RUNTIME_OPTIONS, ...options };
}

export function getMissionRuntimeOptions(): MissionRuntimeOptions {
    return runtimeOptions;
}
