/**
 * Cached Document Interface
 */

export interface CachedDocument {
    url: string;
    title: string;
    content: string;
    fetchedAt: string;
    expiresAt: string;
    size: number;
}
