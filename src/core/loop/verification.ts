/**
 * Verification Checklist Module
 * 
 * Provides a structured checklist system for mission completion verification.
 * 
 * The LLM creates and checks items in .opencode/verification-checklist.md
 * The hook system verifies all items are checked before allowing SEAL.
 * 
 * This approach:
 * 1. LLM discovers environment and creates appropriate checklist items
 * 2. LLM executes and marks items as complete
 * 3. Hook verifies all items are checked (hard gate)
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
    PATHS,
    MISSION_SEAL,
    // Verification constants
    CHECKLIST,
    CHECKLIST_PATTERNS,
    CHECKLIST_CATEGORIES,
    // Verification types
    type ChecklistCategory,
    type ChecklistItem,
    type ChecklistVerificationResult,
    type VerificationResult,
} from "../../shared/index.js";
import { log } from "../agents/logger.js";

// Re-export for backward compatibility
export type { ChecklistItem, ChecklistCategory, ChecklistVerificationResult, VerificationResult };

/** Path to the verification checklist file (re-export for convenience) */
export const CHECKLIST_FILE = CHECKLIST.FILE;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a single line into a checklist item
 */
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

/**
 * Detect category from header line
 */
function detectCategory(headerLine: string): ChecklistCategory {
    const headerLower = headerLine.toLowerCase();

    if (headerLower.includes('code quality') || headerLower.includes('lint') || headerLower.includes('type')) {
        return 'code-quality';
    }
    if (headerLower.includes('unit test')) {
        return 'unit-tests';
    }
    if (headerLower.includes('integration') || headerLower.includes('e2e')) {
        return 'integration-tests';
    }
    if (headerLower.includes('build')) {
        return 'build';
    }
    if (headerLower.includes('runtime') || headerLower.includes('start') || headerLower.includes('run')) {
        return 'runtime';
    }
    if (headerLower.includes('infrastructure') || headerLower.includes('environment') ||
        headerLower.includes('docker') || headerLower.includes('deploy')) {
        return 'infrastructure';
    }

    return 'custom';
}

/**
 * Parse checklist from markdown content
 */
export function parseChecklist(content: string): ChecklistItem[] {
    const items: ChecklistItem[] = [];
    const lines = content.split('\n');

    let currentCategory: ChecklistCategory = 'custom';

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

/**
 * Read checklist from file
 */
export function readChecklist(directory: string): ChecklistItem[] {
    const filePath = join(directory, CHECKLIST_FILE);

    if (!existsSync(filePath)) {
        return [];
    }

    try {
        const content = readFileSync(filePath, 'utf-8');
        return parseChecklist(content);
    } catch (error) {
        log(`[checklist] Failed to read checklist: ${error}`);
        return [];
    }
}

// ============================================================================
// Verification Functions
// ============================================================================

/**
 * Verify that all checklist items are complete
 */
export function verifyChecklist(directory: string): ChecklistVerificationResult {
    const result: ChecklistVerificationResult = {
        passed: false,
        totalItems: 0,
        completedItems: 0,
        incompleteItems: 0,
        progress: "0/0",
        incompleteList: [],
        errors: []
    };

    const filePath = join(directory, CHECKLIST_FILE);

    // Check if checklist file exists
    if (!existsSync(filePath)) {
        result.errors.push(`Verification checklist not found at ${CHECKLIST_FILE}`);
        result.errors.push("Create checklist with at least: build, tests, and any environment-specific checks");
        return result;
    }

    // Parse checklist
    const items = readChecklist(directory);

    if (items.length === 0) {
        result.errors.push("Verification checklist is empty");
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

    result.passed = result.incompleteItems === 0 && result.totalItems > 0;

    log("[checklist] Verification result", {
        passed: result.passed,
        progress: result.progress,
        totalItems: result.totalItems,
        completedItems: result.completedItems
    });

    return result;
}

/**
 * Quick check if checklist exists and has items
 */
export function hasValidChecklist(directory: string): boolean {
    const items = readChecklist(directory);
    return items.length > 0;
}

/**
 * Get checklist summary for display
 */
export function getChecklistSummary(directory: string): string {
    const items = readChecklist(directory);

    if (items.length === 0) {
        return "No checklist found";
    }

    const completed = items.filter(i => i.completed).length;
    const byCategory = new Map<ChecklistCategory, { total: number; done: number }>();

    for (const item of items) {
        const cat = byCategory.get(item.category) || { total: 0, done: 0 };
        cat.total++;
        if (item.completed) cat.done++;
        byCategory.set(item.category, cat);
    }

    const lines = [`Checklist: ${completed}/${items.length}`];

    for (const [category, stats] of byCategory) {
        const icon = stats.done === stats.total ? '✅' : '⏳';
        lines.push(`  ${icon} ${CHECKLIST_CATEGORIES.LABELS[category]}: ${stats.done}/${stats.total}`);
    }

    return lines.join('\n');
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build prompt for when checklist verification fails
 */
export function buildChecklistFailurePrompt(result: ChecklistVerificationResult): string {
    const incompleteFormatted = result.incompleteList
        .map((item, i) => `${i + 1}. [ ] ${item}`)
        .join('\n');

    return `<verification_failure>
⚠️ **SEAL REJECTED - Verification Checklist Incomplete**

Your SEAL was detected but the verification checklist is **NOT COMPLETE**.

## Status: ${result.progress} items verified

## Incomplete Items (${result.incompleteItems} remaining):
${incompleteFormatted || "No items parsed - check checklist format"}

## REQUIRED ACTIONS

1. **Review checklist**: \`cat ${CHECKLIST_FILE}\`
2. **Complete each unchecked item**:
   - Run the verification command
   - Confirm it passes
   - Mark the item as [x] in the checklist
3. **Only output ${MISSION_SEAL.PATTERN} when ALL items are [x]**

### Checklist Format
Each item should be marked complete when verified:
\`\`\`markdown
- [x] ✅ Completed item (verified)
- [ ] ⏳ Pending item (not yet verified)
\`\`\`

⚠️ The system verifies the checklist file. SEAL will be REJECTED until all items are [x].

**CONTINUE WORKING NOW** - Complete the remaining verification items.
</verification_failure>`;
}

/**
 * Build checklist creation prompt (for inclusion in agent prompts)
 */
export function getChecklistCreationInstructions(): string {
    return `
## Verification Checklist Requirements

Before sealing, you MUST create and complete a verification checklist at \`${CHECKLIST_FILE}\`.

### Checklist Template
\`\`\`markdown
# Verification Checklist

## Code Quality
- [ ] **Lint**: No lint errors (\`npm run lint\` or equivalent)
- [ ] **Type Check**: Type checking passes (\`tsc --noEmit\` or equivalent)

## Unit Tests
- [ ] **Unit Tests**: All unit tests pass

## Integration Tests
- [ ] **E2E Tests**: All integration/E2E tests pass (if applicable)

## Build Verification
- [ ] **Build**: Project builds successfully
- [ ] **Bundle Size**: Bundle size is acceptable (if applicable)

## Runtime Verification
- [ ] **Dev Server**: Development server starts correctly (if applicable)
- [ ] **Production**: Production build runs correctly (if applicable)

## Infrastructure & Environment (Discover & Add)
- [ ] **[Discovered Item]**: [Description] (add based on project)

## Project-Specific Checks (Discover & Add)
- [ ] **[Custom Check]**: [Description] (add based on project needs)
\`\`\`

### Instructions
1. **Discover**: Examine the project structure to identify all verification needs
2. **Adapt**: Add/remove items based on what exists in this project
3. **Execute**: Run each verification and record the result
4. **Mark**: Check off [x] each item as it passes
5. **Only SEAL when ALL items are [x]**

### Environment Discovery Hints
- \`package.json\` → npm scripts, test commands
- \`Makefile\` → make targets
- \`docker-compose.yml\` → container orchestration
- \`Dockerfile\` → container build
- \`.github/workflows/\` → CI/CD checks
- \`Cargo.toml\` → Rust builds
- \`pyproject.toml\` → Python builds
- \`go.mod\` → Go builds

⚠️ **SYSTEM ENFORCEMENT**: The hook verifies all checklist items are [x] before allowing SEAL.
`;
}

// ============================================================================
// Combined Verification (for backward compatibility)
// ============================================================================

// Note: VerificationResult interface is now defined in shared/verification/interfaces
// and imported at the top of this file

/** Pattern to match incomplete TODO items */
const TODO_INCOMPLETE_PATTERN = /^[-*]\s*\[\s*\]/gm;

/** Pattern to match complete TODO items */
const TODO_COMPLETE_PATTERN = /^[-*]\s*\[[xX]\]/gm;

/** Patterns indicating issues in sync-issues.md */
const SYNC_ISSUE_PATTERNS = [
    /^[-*]\s+\S/gm,
    /ERROR/gi,
    /FAIL/gi,
    /CONFLICT/gi,
];

/**
 * Count pattern matches in text
 */
function countMatches(text: string, pattern: RegExp): number {
    const matches = text.match(pattern);
    return matches?.length ?? 0;
}

/**
 * Check if sync-issues content indicates real issues
 */
function hasRealSyncIssues(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) return false;
    if (/^#\s*Sync Issues\s*$/i.test(trimmed)) return false;

    for (const pattern of SYNC_ISSUE_PATTERNS) {
        if (pattern.test(trimmed)) return true;
    }

    const lines = trimmed.split('\n').filter(l => {
        const line = l.trim();
        return line && !line.startsWith('#') && line !== '---';
    });

    return lines.length > 0;
}

/**
 * Verify mission completion conditions
 * 
 * Checks (in order):
 * 1. Verification checklist (primary - if exists)
 * 2. TODO completion rate (fallback)
 * 3. Sync issues (always checked)
 */
export function verifyMissionCompletion(directory: string): VerificationResult {
    const result: VerificationResult = {
        passed: false,
        todoComplete: false,
        todoProgress: "0/0",
        todoIncomplete: 0,
        syncIssuesEmpty: true,
        syncIssuesCount: 0,
        checklistComplete: false,
        checklistProgress: "0/0",
        errors: []
    };

    // 1. Check Verification Checklist (Primary gate if exists)
    const checklistResult = verifyChecklist(directory);
    result.checklistComplete = checklistResult.passed;
    result.checklistProgress = checklistResult.progress;

    const hasChecklist = checklistResult.totalItems > 0;

    if (hasChecklist && !checklistResult.passed) {
        // Checklist exists but incomplete
        result.errors.push(`Verification checklist incomplete: ${checklistResult.progress}`);
        result.errors.push(...checklistResult.incompleteList.slice(0, 5).map(i => `  - ${i}`));
        if (checklistResult.incompleteList.length > 5) {
            result.errors.push(`  ... and ${checklistResult.incompleteList.length - 5} more`);
        }
    }

    // 2. Verify TODO completion (if no checklist, this is primary)
    const todoPath = join(directory, PATHS.TODO);
    if (existsSync(todoPath)) {
        try {
            const content = readFileSync(todoPath, 'utf-8');
            const incompleteCount = countMatches(content, TODO_INCOMPLETE_PATTERN);
            const completeCount = countMatches(content, TODO_COMPLETE_PATTERN);
            const total = incompleteCount + completeCount;

            result.todoIncomplete = incompleteCount;
            result.todoComplete = incompleteCount === 0 && total > 0;
            result.todoProgress = `${completeCount}/${total}`;

            if (!result.todoComplete && !hasChecklist) {
                if (total === 0) {
                    result.errors.push("No TODO items found - create tasks first");
                } else {
                    result.errors.push(
                        `TODO incomplete: ${result.todoProgress} (${incompleteCount} remaining)`
                    );
                }
            }
        } catch (error) {
            result.errors.push(`Failed to read TODO: ${error}`);
        }
    } else if (!hasChecklist) {
        result.errors.push(`TODO file not found at ${PATHS.TODO}`);
    }

    // 3. Verify sync issues are resolved (always checked)
    const syncPath = join(directory, PATHS.SYNC_ISSUES);
    if (existsSync(syncPath)) {
        try {
            const content = readFileSync(syncPath, 'utf-8');
            result.syncIssuesEmpty = !hasRealSyncIssues(content);

            if (!result.syncIssuesEmpty) {
                const issueLines = content.split('\n').filter(l =>
                    /^[-*]\s+\S/.test(l.trim()) || /ERROR|FAIL|CONFLICT/i.test(l)
                );
                result.syncIssuesCount = issueLines.length;
                result.errors.push(
                    `Sync issues not resolved: ${result.syncIssuesCount} issue(s) remain`
                );
            }
        } catch (error) {
            result.syncIssuesEmpty = true;
        }
    }

    // Final pass determination:
    // - If checklist exists: checklist must pass + sync issues must be empty
    // - If no checklist: TODO must be complete + sync issues must be empty
    if (hasChecklist) {
        result.passed = result.checklistComplete && result.syncIssuesEmpty;
    } else {
        result.passed = result.todoComplete && result.syncIssuesEmpty;
    }

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

/**
 * Build prompt for when SEAL is rejected due to verification failure
 */
export function buildVerificationFailurePrompt(result: VerificationResult): string {
    const errorList = result.errors.map(e => `❌ ${e}`).join('\n');
    const hasChecklist = result.checklistProgress !== "0/0";

    return `<verification_failure>
⚠️ **SEAL REJECTED - Verification Failed**

Your <mission_seal>SEALED</mission_seal> was detected but the following checks **FAILED**:

${errorList}

## Current Status
| Check | Status | Details |
|-------|--------|---------|
${hasChecklist ? `| Checklist | ${result.checklistComplete ? '✅' : '❌'} | ${result.checklistProgress} verified |` : ''}
| TODO Progress | ${result.todoComplete ? '✅' : '❌'} | ${result.todoProgress} complete |
| Sync Issues | ${result.syncIssuesEmpty ? '✅' : '❌'} | ${result.syncIssuesCount} issue(s) |

## REQUIRED ACTIONS (DO NOT OUTPUT SEAL AGAIN)

${hasChecklist ? `1. **Complete Checklist**: \`cat ${CHECKLIST_FILE}\` - Check off ALL [ ] items
2. **Verify each item passes** before marking [x]` : `1. **Check TODO**: \`cat ${PATHS.TODO}\` - Find ALL [ ] items
2. **Complete remaining tasks** - Execute each incomplete item`}
3. **Check sync issues**: \`cat ${PATHS.SYNC_ISSUES}\` - Resolve any errors
4. **Verify builds/tests pass** - Run project build and test commands
5. **Only output ${MISSION_SEAL.PATTERN} when ALL conditions pass**

⚠️ The system will REJECT premature SEAL every time. Work until truly complete.

**CONTINUE EXECUTING NOW** - Do not wait for user input.
</verification_failure>`;
}

/**
 * Build a concise status summary for logs
 */
export function buildVerificationSummary(result: VerificationResult): string {
    const status = result.passed ? "✅ PASSED" : "❌ FAILED";
    const hasChecklist = result.checklistProgress !== "0/0";

    if (hasChecklist) {
        return `[Verification ${status}] Checklist: ${result.checklistProgress}, TODO: ${result.todoProgress}, Sync: ${result.syncIssuesEmpty ? 'clean' : result.syncIssuesCount + ' issues'}`;
    }
    return `[Verification ${status}] TODO: ${result.todoProgress}, Sync: ${result.syncIssuesEmpty ? 'clean' : result.syncIssuesCount + ' issues'}`;
}

