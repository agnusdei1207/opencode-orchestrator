import { resolve } from "node:path";

export interface MissionRuntimeOptions {
    ledger: boolean;
    markdownMemory: boolean;
    maxEvidenceEvents: number;
}

export const DEFAULT_MISSION_RUNTIME_OPTIONS: MissionRuntimeOptions = {
    ledger: true,
    markdownMemory: true,
    maxEvidenceEvents: 20,
};

let defaultOptions: MissionRuntimeOptions = { ...DEFAULT_MISSION_RUNTIME_OPTIONS };
// One OpenCode process can serve several projects, each with its own plugin options.
const optionsByDirectory = new Map<string, MissionRuntimeOptions>();

/**
 * Set the options for one project directory, or the process default when no
 * directory is given.
 */
export function configureMissionRuntimeOptions(options: Partial<MissionRuntimeOptions>, directory?: string): void {
    const resolved = { ...DEFAULT_MISSION_RUNTIME_OPTIONS, ...options };
    if (directory === undefined) {
        defaultOptions = resolved;
        optionsByDirectory.clear();
        return;
    }
    optionsByDirectory.set(resolve(directory), resolved);
}

export function getMissionRuntimeOptions(directory: string): MissionRuntimeOptions {
    return optionsByDirectory.get(resolve(directory)) ?? defaultOptions;
}
