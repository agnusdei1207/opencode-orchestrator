/**
 * Knowledge Module - Barrel Export
 *
 * Re-exports all knowledge graph modules (Phase 1-7)
 * for clean module boundary access from the rest of the framework.
 */

export { TagIndexer } from "./tag-indexer.js";
export type { FrontmatterData } from "./tag-indexer.js";
export { GraphParser } from "./graph-parser.js";
export { HybridSearch } from "./hybrid-search.js";
export type { SearchResult } from "./hybrid-search.js";
export { Scratchpad } from "./scratchpad.js";
export {
    getMissionCanvasPath,
    getMissionScratchpadPath,
    syncMissionMemory,
} from "./mission-memory.js";
export { SafetyGuards } from "./safety-guards.js";
export type { WriteQueue } from "./safety-guards.js";
export { MemoryConsolidation } from "./memory-consolidation.js";
export { MemoryLifecycle, runMemoryMaintenance } from "./memory-lifecycle.js";
export type {
    MemoryLayer,
    MemoryLifecyclePlan,
    MemoryLifecycleRecord,
    MemoryMaintenanceOptions,
    MemoryMaintenanceResult,
    MemoryTierDecision,
    TemporalSupersession,
} from "./memory-lifecycle.js";
export { evaluateMemoryRetrieval } from "./memory-evaluation.js";
export type {
    MemoryEvalCase,
    MemoryEvalCategory,
    MemoryEvalCategoryResult,
    MemoryEvalResult,
} from "./memory-evaluation.js";
