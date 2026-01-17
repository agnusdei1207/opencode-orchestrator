/**
 * Cache Stats Interface
 */

export interface CacheStats {
    totalDocuments: number;
    totalSize: number;
    expiredCount: number;
    oldestDocument: string | null;
    newestDocument: string | null;
}
