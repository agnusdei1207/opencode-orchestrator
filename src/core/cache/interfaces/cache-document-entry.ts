/**
 * Cache Document Entry Interface
 */

export interface CacheDocumentEntry {
    url: string;
    title: string;
    fetchedAt: string;
    expiresAt: string;
    size: number;
}
