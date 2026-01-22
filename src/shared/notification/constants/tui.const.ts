/**
 * TUI Constants for Notification System
 */

export const TUI_ICONS = {
    RUNNING: "⚡",
    QUEUED: "⏳",
    MISSION_SEALED: "🎉",
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
    MISSION_SEALED_TITLE: "MISSION ACCOMPLISHED",
    MISSION_SEALED_SUBTITLE: "Passed all verifications.\nCodebase is sealed.",
} as const;
