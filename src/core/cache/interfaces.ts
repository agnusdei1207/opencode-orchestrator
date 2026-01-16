/**
 * Document Cache Interfaces
 */

/**
 * Cached document structure
 */
export interface CachedDocument {
    url: string;
    title: string;
    content: string;
    fetchedAt: string;
    expiresAt: string;
    size: number;
}

/**
 * Cache metadata structure
 */
export interface CacheMetadata {
    documents: Record<string, CacheDocumentEntry>;
    lastUpdated: string;
}

/**
 * Individual document entry in metadata
 */
export interface CacheDocumentEntry {
    url: string;
    title: string;
    fetchedAt: string;
    expiresAt: string;
    size: number;
}

/**
 * Document listing entry
 */
export interface CacheListEntry {
    filename: string;
    url: string;
    title: string;
    fetchedAt: string;
    expiresAt: string;
    size: number;
    expired: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
    totalDocuments: number;
    totalSize: number;
    expiredCount: number;
    oldestDocument: string | null;
    newestDocument: string | null;
}
