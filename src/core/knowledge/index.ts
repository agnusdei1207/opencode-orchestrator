/**
 * Mission Memory Module - Barrel Export
 *
 * Exports active mission working memory (brief / scratchpad / canvas).
 * The obsolete in-memory Knowledge RAG subsystem has been decommissioned per ADR-0019.
 */

export {
    getMissionCanvasPath,
    getMissionScratchpadPath,
    getMissionMemoryNotesDirPath,
    readMissionScratchpadSnapshot,
    syncMissionMemory,
    parseFrontmatter,
} from "./mission-memory.js";
export type { FrontmatterData } from "./mission-memory.js";
export { syncMissionEpisodeMemory } from "./mission-episode.js";
