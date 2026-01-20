/**
 * Progress Formatting Utilities
 */

import type { ProgressSnapshot } from "./interfaces.js";
import { LIMITS } from "../../shared/index.js";

/**
 * Format elapsed time
 */
export function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Format progress bar
 */
export function formatProgressBar(percentage: number, width: number = LIMITS.DEFAULT_PROGRESS_WIDTH): string {
    const filled = Math.round(width * percentage / 100);
    const empty = width - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${percentage}%`;
}

/**
 * Get formatted progress string
 */
export function formatSnapshot(snapshot: ProgressSnapshot): string {
    const lines: string[] = [];

    lines.push(`📊 **Progress Report**`);
    lines.push(`⏱️ Elapsed: ${formatElapsed(snapshot.elapsedMs)}`);

    if (snapshot.todos.total > 0) {
        lines.push(`✅ Todos: ${snapshot.todos.completed}/${snapshot.todos.total} ${formatProgressBar(snapshot.todos.percentage, 15)}`);
    }

    if (snapshot.tasks.total > 0) {
        lines.push(`🔄 Tasks: ${snapshot.tasks.completed}/${snapshot.tasks.total} ${formatProgressBar(snapshot.tasks.percentage, 15)}`);
        if (snapshot.tasks.running > 0) {
            lines.push(`   ⚡ ${snapshot.tasks.running} running`);
        }
        if (snapshot.tasks.failed > 0) {
            lines.push(`   ❌ ${snapshot.tasks.failed} failed`);
        }
    }

    if (snapshot.steps.max !== Infinity) {
        lines.push(`📍 Step: ${snapshot.steps.current}/${snapshot.steps.max}`);
    } else {
        lines.push(`📍 Step: ${snapshot.steps.current} (unlimited)`);
    }

    return lines.join("\n");
}

/**
 * Get compact progress string (for inline display)
 */
export function formatCompact(snapshot: ProgressSnapshot): string {
    const parts: string[] = [];

    if (snapshot.todos.total > 0) {
        parts.push(`✅${snapshot.todos.completed}/${snapshot.todos.total}`);
    }

    if (snapshot.tasks.running > 0) {
        parts.push(`⚡${snapshot.tasks.running}`);
    }

    parts.push(`⏱${formatElapsed(snapshot.elapsedMs)}`);

    return parts.join(" | ");
}
