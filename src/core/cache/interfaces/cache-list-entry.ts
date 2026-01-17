/**
 * Cache List Entry Interface
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
