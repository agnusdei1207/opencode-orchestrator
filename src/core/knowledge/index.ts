/**
 * Knowledge Module - Barrel Export
 *
 * Re-exports the TagIndexer (Phase 1) and GraphParser (Phase 2)
 * for clean module boundary access from the rest of the framework.
 */

export { TagIndexer } from "./tag-indexer.js";
export type { FrontmatterData } from "./tag-indexer.js";
export { GraphParser } from "./graph-parser.js";
