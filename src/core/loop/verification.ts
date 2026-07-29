/**
 * Verification Checklist Module
 * 
 * Provides a structured checklist system for mission completion verification.
 * 
 * The LLM creates and checks items in .opencode/verification-checklist.md
 * The hook system verifies all items are checked before allowing CONCLUDE.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
    PATHS,
    // Verification constants
    CHECKLIST,
    CHECKLIST_PATTERNS,
    CHECKLIST_CATEGORIES,
    type ChecklistCategory,
    type ChecklistItem,
    type ChecklistVerificationResult,
    type VerificationResult,
} from "../../shared/index.js";
import { log } from "../agents/logger.js";
export {
    buildVerificationFailurePrompt,
    buildVerificationSummary,
} from "./verification-prompts.js";

export const CHECKLIST_FILE = CHECKLIST.FILE;

interface ChecklistReadResult {
    present: boolean;
    empty: boolean;
    items: ChecklistItem[];
    error?: string;
}

const CHECKLIST_READ_ERROR_PREFIX = "Failed to read verification checklist";

// ============================================================================
// Parsing Functions
// ============================================================================

function parseChecklistLine(line: string, currentCategory: ChecklistCategory): ChecklistItem | null {
    const trimmedLine = line.trim();

    // Try parsing with ID format: - [ ] **ID**: Description
    const idMatch = trimmedLine.match(CHECKLIST_PATTERNS.ITEM_WITH_ID);
    if (idMatch) {
        return {
            id: idMatch[2].toLowerCase().replace(/\s+/g, '-'),
            category: currentCategory,
            description: idMatch[3],
            completed: idMatch[1].toLowerCase() === 'x',
        };
    }

    // Try parsing simple format: - [ ] Description
    const simpleMatch = trimmedLine.match(CHECKLIST_PATTERNS.SIMPLE_ITEM);
    if (simpleMatch) {
        const desc = simpleMatch[2];
        return {
            id: desc.toLowerCase().replace(/\s+/g, '-').substring(0, 30),
            category: currentCategory,
            description: desc,
            completed: simpleMatch[1].toLowerCase() === 'x',
        };
    }

    return null;
}

function detectCategory(headerLine: string): ChecklistCategory {
    const headerLower = headerLine.toLowerCase();

    if (headerLower.includes('code quality') || headerLower.includes('lint') || headerLower.includes('type')) {
        return CHECKLIST_CATEGORIES.IDS.CODE_QUALITY;
    }
    if (headerLower.includes('unit test')) {
        return CHECKLIST_CATEGORIES.IDS.UNIT_TESTS;
    }
    if (headerLower.includes('integration') || headerLower.includes('e2e')) {
        return CHECKLIST_CATEGORIES.IDS.INTEGRATION_TESTS;
    }
    if (headerLower.includes('build')) {
        return CHECKLIST_CATEGORIES.IDS.BUILD;
    }
    if (headerLower.includes('runtime') || headerLower.includes('start') || headerLower.includes('run')) {
        return CHECKLIST_CATEGORIES.IDS.RUNTIME;
    }
    if (headerLower.includes('infrastructure') || headerLower.includes('environment') ||
        headerLower.includes('docker') || headerLower.includes('deploy')) {
        return CHECKLIST_CATEGORIES.IDS.INFRASTRUCTURE;
    }

    return CHECKLIST_CATEGORIES.IDS.CUSTOM;
}

export function parseChecklist(content: string): ChecklistItem[] {
    const items: ChecklistItem[] = [];
    const lines = content.split('\n');

    let currentCategory: ChecklistCategory = CHECKLIST_CATEGORIES.IDS.CUSTOM;

    for (const line of lines) {
        const trimmed = line.trim();

        // Check for category header
        if (trimmed.startsWith('## ')) {
            currentCategory = detectCategory(trimmed);
            continue;
        }

        // Try to parse as checklist item
        const item = parseChecklistLine(line, currentCategory);
        if (item) {
            items.push(item);
        }
    }

    return items;
}

function readChecklistWithDiagnostics(directory: string): ChecklistReadResult {
    const filePath = join(directory, CHECKLIST_FILE);

    if (!existsSync(filePath)) {
        return { present: false, empty: true, items: [] };
    }

    try {
        const content = readFileSync(filePath, 'utf-8');
        return {
            present: true,
            empty: content.trim().length === 0,
            items: parseChecklist(content),
        };
    } catch (error) {
        log(`[checklist] Failed to read checklist: ${error}`);
        return {
            present: true,
            empty: false,
            items: [],
            error: `${CHECKLIST_READ_ERROR_PREFIX}: ${error}`,
        };
    }
}

// ============================================================================
// Verification Functions
// ============================================================================

export function verifyChecklist(directory: string): ChecklistVerificationResult {
    const checklistRead = readChecklistWithDiagnostics(directory);
    const result: ChecklistVerificationResult = {
        present: checklistRead.present,
        passed: false,
        totalItems: 0,
        completedItems: 0,
        incompleteItems: 0,
        progress: "0/0",
        incompleteList: [],
        errors: []
    };

    if (!checklistRead.present) {
        result.errors.push(`Verification checklist not found at ${CHECKLIST_FILE}`);
        result.errors.push("Create checklist with at least: build, tests, and any environment-specific checks");
        return result;
    }

    const items = checklistRead.items;

    if (checklistRead.error) {
        result.errors.push(checklistRead.error);
        return result;
    }

    if (items.length < CHECKLIST.MIN_ITEMS) {
        const error = checklistRead.empty
            ? "Verification checklist is empty"
            : "Verification checklist contains no valid items";
        result.errors.push(error);
        result.errors.push("Add verification items (build, tests, environment checks)");
        return result;
    }

    // Count completions
    result.totalItems = items.length;
    result.completedItems = items.filter(i => i.completed).length;
    result.incompleteItems = result.totalItems - result.completedItems;
    result.progress = `${result.completedItems}/${result.totalItems}`;

    // Collect incomplete items
    result.incompleteList = items
        .filter(i => !i.completed)
        .map(i => `[${CHECKLIST_CATEGORIES.LABELS[i.category]}] ${i.description}`);

    if (result.incompleteItems > 0) {
        result.errors.push(`Checklist incomplete: ${result.progress}`);
    }

    result.passed = result.incompleteItems === 0 && result.totalItems >= CHECKLIST.MIN_ITEMS;

    log("[checklist] Verification result", {
        passed: result.passed,
        progress: result.progress,
        totalItems: result.totalItems,
        completedItems: result.completedItems
    });

    return result;
}

interface TodoCompletionStats {
    complete: number;
    incomplete: number;
    total: number;
}

const TODO_CHECKBOX_PATTERN = /^\s*[-*]\s*\[([xX\s])\]/;

const TODO_STATUS_PATTERN = /\bstatus:\s*([a-zA-Z_-]+)/i;

const TODO_COMPLETE_STATUSES = new Set([
    "complete",
    "completed",
    "done",
    "verified",
]);

const TODO_INCOMPLETE_STATUSES = new Set([
    "pending",
    "in_progress",
    "running",
    "queued",
    "blocked",
    "failed",
    "error",
]);

const SYNC_ISSUES_HEADER_PATTERN = /^#+\s*Sync Issues\s*$/i;

function normalizeTodoStatus(status: string): string {
    return status.trim().toLowerCase().replace(/-/g, "_");
}

function isCompleteTodoStatus(status: string): boolean | undefined {
    const normalized = normalizeTodoStatus(status);

    if (TODO_COMPLETE_STATUSES.has(normalized)) return true;
    if (TODO_INCOMPLETE_STATUSES.has(normalized)) return false;
    return undefined;
}

export function countTodoCompletion(content: string): TodoCompletionStats {
    const stats: TodoCompletionStats = {
        complete: 0,
        incomplete: 0,
        total: 0,
    };

    for (const line of content.split('\n')) {
        const checkbox = line.match(TODO_CHECKBOX_PATTERN);
        if (checkbox) {
            const completed = checkbox[1].toLowerCase() === 'x';
            stats.complete += completed ? 1 : 0;
            stats.incomplete += completed ? 0 : 1;
            stats.total += 1;
            continue;
        }

        const status = line.match(TODO_STATUS_PATTERN)?.[1];
        if (!status) continue;

        const completed = isCompleteTodoStatus(status);
        if (completed === undefined) continue;

        stats.complete += completed ? 1 : 0;
        stats.incomplete += completed ? 0 : 1;
        stats.total += 1;
    }

    return stats;
}

function createVerificationResult(): VerificationResult {
    return {
        passed: false,
        todoComplete: false,
        todoPresent: false,
        todoProgress: "0/0",
        todoIncomplete: 0,
        syncIssuesEmpty: true,
        syncIssuesCount: 0,
        checklistComplete: false,
        checklistPresent: false,
        checklistProgress: "0/0",
        errors: []
    };
}

export function getSyncIssueLines(content: string): string[] {
    const trimmed = content.trim();
    if (!trimmed) return [];

    return trimmed
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line !== '---' && !SYNC_ISSUES_HEADER_PATTERN.test(line));
}

function applyChecklistVerification(directory: string, result: VerificationResult): boolean {
    const checklistResult = verifyChecklist(directory);
    result.checklistComplete = checklistResult.passed;
    result.checklistPresent = checklistResult.present;
    result.checklistProgress = checklistResult.progress;

    if (checklistResult.present && !checklistResult.passed) {
        result.errors.push(...checklistResult.errors);
        result.errors.push(...checklistResult.incompleteList
            .slice(0, CHECKLIST.MAX_ERROR_ITEMS)
            .map(item => `  - ${item}`));
        if (checklistResult.incompleteList.length > CHECKLIST.MAX_ERROR_ITEMS) {
            const remaining = checklistResult.incompleteList.length - CHECKLIST.MAX_ERROR_ITEMS;
            result.errors.push(`  ... and ${remaining} more`);
        }
    }

    return checklistResult.present;
}

function applyTodoVerification(directory: string, result: VerificationResult, hasChecklist: boolean): void {
    const todoPath = join(directory, PATHS.TODO);
    result.todoPresent = existsSync(todoPath);
    if (result.todoPresent) {
        try {
            const content = readFileSync(todoPath, 'utf-8');
            const stats = countTodoCompletion(content);

            result.todoIncomplete = stats.incomplete;
            result.todoComplete = stats.incomplete === 0 && stats.total > 0;
            result.todoProgress = `${stats.complete}/${stats.total}`;

            if (!result.todoComplete) {
                if (stats.total === 0 && !hasChecklist) {
                    result.errors.push("No TODO items found - create tasks first");
                } else if (stats.total > 0) {
                    result.errors.push(
                        `TODO incomplete: ${result.todoProgress} (${stats.incomplete} remaining)`
                    );
                }
            }
        } catch (error) {
            result.errors.push(`Failed to read TODO: ${error}`);
        }
    } else if (!hasChecklist) {
        result.errors.push(`TODO file not found at ${PATHS.TODO}`);
    }
}

function applySyncIssueVerification(directory: string, result: VerificationResult): void {
    const syncPath = join(directory, PATHS.SYNC_ISSUES);
    if (existsSync(syncPath)) {
        try {
            const content = readFileSync(syncPath, 'utf-8');
            const issueLines = getSyncIssueLines(content);
            result.syncIssuesEmpty = issueLines.length === 0;

            if (!result.syncIssuesEmpty) {
                result.syncIssuesCount = issueLines.length;
                result.errors.push(
                    `Sync issues not resolved: ${result.syncIssuesCount} issue(s) remain`
                );
            }
        } catch (error) {
            log(`[verification] Failed to read sync issues file: ${error}`);
            result.syncIssuesEmpty = false;
            result.syncIssuesCount = 1;
            result.errors.push(`Failed to read sync issues: ${error}`);
        }
    }
}

function hasTodoItems(result: VerificationResult): boolean {
    return result.todoProgress !== "0/0";
}

function isVerificationPassed(result: VerificationResult, hasChecklist: boolean): boolean {
    return hasChecklist
        ? result.checklistComplete && result.syncIssuesEmpty && (!hasTodoItems(result) || result.todoComplete)
        : result.todoComplete && result.syncIssuesEmpty;
}

export function verifyMissionCompletion(directory: string): VerificationResult {
    const result = createVerificationResult();
    const hasChecklist = applyChecklistVerification(directory, result);

    applyTodoVerification(directory, result, hasChecklist);
    applySyncIssueVerification(directory, result);

    result.passed = isVerificationPassed(result, hasChecklist);

    log("[verification] Mission verification result", {
        passed: result.passed,
        hasChecklist,
        checklistProgress: result.checklistProgress,
        todoProgress: result.todoProgress,
        syncIssuesEmpty: result.syncIssuesEmpty,
        errors: result.errors.length > 0 ? result.errors : undefined
    });

    return result;
}
