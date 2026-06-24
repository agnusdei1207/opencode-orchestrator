/**
 * Document Cache Module
 */

// Re-export owner-defined contracts
export type { CacheDocumentEntry, CacheMetadata } from "./utils.js";
export type { CachedDocument, CacheListEntry, CacheStats } from "./operations.js";

// Re-export operations
export {
    get,
    getByFilename,
    set,
    remove,
    list,
    clear,
    cleanExpired,
    stats,
} from "./operations.js";
