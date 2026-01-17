/**
 * Cache Metadata Interface
 */

import type { CacheDocumentEntry } from "./cache-document-entry.js";

export interface CacheMetadata {
    documents: Record<string, CacheDocumentEntry>;
    lastUpdated: string;
}
