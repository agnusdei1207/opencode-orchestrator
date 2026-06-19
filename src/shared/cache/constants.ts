/**
 * Cache constants
 */
import { TIME } from "../core/constants.js";

export const CACHE = {
    /** Default cache TTL (24 hours) */
    DEFAULT_TTL_MS: 24 * TIME.HOUR,
    /** Maximum cache entries */
    MAX_ENTRIES: 100,
    /** Session TTL (24 hours for long tasks) */
    SESSION_TTL_MS: 24 * TIME.HOUR,
} as const;

export const CACHE_ACTIONS = {
    LIST: "list",
    GET: "get",
    CLEAR: "clear",
    STATS: "stats",
} as const;

export type CacheAction = (typeof CACHE_ACTIONS)[keyof typeof CACHE_ACTIONS];

/**
 * Filter Status (for list operations)
 */
export const FILTER_STATUS = {
    ALL: "all",
    RUNNING: "running",
    DONE: "done",
    COMPLETED: "completed",
    ERROR: "error",
    PENDING: "pending",
} as const;

export type FilterStatus = (typeof FILTER_STATUS)[keyof typeof FILTER_STATUS];
