/**
 * memory-maintenance-runner.ts — Opt-in entry point that runs the memory
 * lifecycle over the generated mission memory notes.
 *
 * This is intentionally NOT invoked by any search/index path. It is wired into
 * the cleanup scheduler behind the `OPENCODE_MEMORY_MAINTENANCE` env flag so a
 * plain run never mutates memory on disk.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getMissionMemoryNotesDirPath } from "./mission-memory.js";
import { runMemoryMaintenance, type MemoryMaintenanceResult } from "./memory-lifecycle.js";

/** Collect generated memory note paths under the mission memories directory. */
export function collectMemoryNotePaths(directory: string): string[] {
    const notesDir = getMissionMemoryNotesDirPath(directory);
    if (!existsSync(notesDir)) return [];
    return readdirSync(notesDir, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith(".md"))
        .map(entry => join(notesDir, entry.name))
        .sort();
}

/**
 * Run a maintenance pass over generated memory notes.
 *
 * Defaults to a dry run (no writes). Pass `{ apply: true }` to persist tier
 * changes (hot/warm/cold/archive layer + tombstones). Physical archive moves
 * stay OFF (`applyArchives: false`) so this never relocates files.
 */
export function runMemoryMaintenancePass(
    directory: string,
    opts: { apply?: boolean; now?: Date } = {},
): MemoryMaintenanceResult {
    return runMemoryMaintenance({
        root: directory,
        filePaths: collectMemoryNotePaths(directory),
        dryRun: !opts.apply,
        applyArchives: false,
        now: opts.now,
    });
}
