/**
 * Cache Actions
 */

export const CACHE_ACTIONS = {
    LIST: "list",
    GET: "get",
    CLEAR: "clear",
    STATS: "stats",
} as const;

export type CacheAction = (typeof CACHE_ACTIONS)[keyof typeof CACHE_ACTIONS];
