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
} from "./interfaces.js";

// Re-export constants
export { CACHE_DIR, METADATA_FILE, DEFAULT_TTL_MS } from "./constants.js";

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
