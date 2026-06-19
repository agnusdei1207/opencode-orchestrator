/**
 * Notification constants (consolidated)
 */
import { TIME } from "../core/constants.js";

/**
 * Toast Duration Constants
 */


export const TOAST_DURATION = {
    /** Extra short: 1.5 seconds */
    EXTRA_SHORT: 1500,
    /** Short: 2 seconds */
    SHORT: 2 * TIME.SECOND,
    /** Medium: 3 seconds */
    MEDIUM: 3 * TIME.SECOND,
    /** Default: 4 seconds */
    DEFAULT: 4 * TIME.SECOND,
    /** Long: 5 seconds */
    LONG: 5 * TIME.SECOND,
    /** Extended: 7 seconds */
    EXTENDED: 7 * TIME.SECOND,
    /** Persistent: 0 (stays until dismissed) */
    PERSISTENT: 0,
} as const;

/**
 * Toast Variants
 */

export const TOAST_VARIANTS = {
    INFO: "info",
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "error",
} as const;


/**
 * TUI Constants for Notification System
 */

export const TUI_ICONS = {
    RUNNING: "⚡",
    QUEUED: "⏳",
    MISSION_COMPLETE: "🎉",
    SHIELD: "🛡️",
    NEW: " <- NEW",
} as const;

export const TUI_BLOCKS = {
    FILLED: "▣",
    EMPTY: "▢",
} as const;

export const TUI_TAGS = {
    BACKGROUND: "BACKGROUND",
    FOREGROUND: "FOREGROUND",
    WAITING: "WAITING",
    PENDING: "PENDING",
} as const;

export const TUI_MESSAGES = {
    MISSION_COMPLETE_TITLE: "MISSION ACCOMPLISHED",
    MISSION_COMPLETE_SUBTITLE: "Passed all verifications.\nWork is complete.",
} as const;



