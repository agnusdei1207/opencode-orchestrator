/**
 * Document Cache Module
 */

// Re-export interfaces
export type { CachedDocument } from "./interfaces/cached-document.js";
export type { CacheMetadata } from "./interfaces/cache-metadata.js";
export type { CacheDocumentEntry } from "./interfaces/cache-document-entry.js";
export type { CacheListEntry } from "./interfaces/cache-list-entry.js";
export type { CacheStats } from "./interfaces/cache-stats.js";

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
