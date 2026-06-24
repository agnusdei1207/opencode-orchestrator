/**
 * Document Cache Module
 */

// Re-export interfaces
export type {
    CachedDocument,
    CacheMetadata,
    CacheDocumentEntry,
    CacheListEntry,
    CacheStats,
} from "./interfaces/index.js";

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
