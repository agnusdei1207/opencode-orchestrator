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
