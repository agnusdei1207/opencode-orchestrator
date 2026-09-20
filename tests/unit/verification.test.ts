/**
 * Verification Module Unit Tests
 * 
 * Tests for mission completion verification logic.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Import the module under test
import {
    verifyMissionCompletion,
    buildVerificationSummary,
} from "../../src/core/loop/verification.js";
import type { VerificationResult } from "../../src/shared/index.js";

describe("Mission Verification", () => {
    let testDir: string;
    let opencodeDir: string;

    beforeEach(() => {
        // Create temporary test directory
        testDir = join(tmpdir(), `test-verification-${Date.now()}`);
        opencodeDir = join(testDir, ".opencode");
        mkdirSync(opencodeDir, { recursive: true });
    });

    afterEach(() => {
        // Cleanup
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe("verifyMissionCompletion", () => {
        describe("TODO verification", () => {
            it("should pass when all TODOs are complete", () => {
                const todoContent = `# TODO

- [x] Task 1
- [x] Task 2
- [x] Task 3
`;
                writeFileSync(join(opencodeDir, "todo.md"), todoContent);

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(true);
                expect(result.todoProgress).toBe("3/3");
                expect(result.todoIncomplete).toBe(0);
            });

            it("should fail when TODOs are incomplete", () => {
                const todoContent = `# TODO

- [x] Task 1
- [ ] Task 2
- [x] Task 3
`;
                writeFileSync(join(opencodeDir, "todo.md"), todoContent);

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(false);
                expect(result.todoProgress).toBe("2/3");
                expect(result.todoIncomplete).toBe(1);
                expect(result.passed).toBe(false);
            });

            it("should handle uppercase [X] as complete", () => {
                const todoContent = `# TODO

- [X] Task 1
- [x] Task 2
`;
                writeFileSync(join(opencodeDir, "todo.md"), todoContent);

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(true);
                expect(result.todoProgress).toBe("2/2");
            });

            it("should fail when no TODO file exists", () => {
                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(false);
                expect(result.todoPresent).toBe(false);
                expect(result.passed).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.errors[0]).toContain("TODO file not found");
            });

            it("should fail when TODO file is empty", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "# TODO\n");

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(false);
                expect(result.todoProgress).toBe("0/0");
            });

            it("should report an empty TODO file as present so a tracked mission is not dropped", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "# TODO\n");

                const result = verifyMissionCompletion(testDir);

                expect(result.todoPresent).toBe(true);
                expect(result.todoProgress).toBe("0/0");
            });

            it("should handle asterisk list markers", () => {
                const todoContent = `# TODO

* [x] Task 1
* [ ] Task 2
`;
                writeFileSync(join(opencodeDir, "todo.md"), todoContent);

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(false);
                expect(result.todoIncomplete).toBe(1);
            });

            it("should count hierarchical TODO status lines", () => {
                const todoContent = `# TODO

## M1: Milestone | status: completed
### T1: Implementation | status: in_progress
### T2: Verification | status: verified
`;
                writeFileSync(join(opencodeDir, "todo.md"), todoContent);

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(false);
                expect(result.todoProgress).toBe("2/3");
                expect(result.todoIncomplete).toBe(1);
            });
        });

        describe("Sync issues verification", () => {
            it("should pass when sync-issues.md doesn't exist", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should pass when sync-issues.md is empty", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), "");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should pass when sync-issues.md only has header", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), "# Sync Issues\n");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should fail when sync-issues.md has issues", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), `# Sync Issues

- TypeScript error in file.ts
- Import conflict in module.ts
`);

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
                expect(result.syncIssuesCount).toBeGreaterThan(0);
                expect(result.passed).toBe(false);
            });

            it("should detect ERROR keyword", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), "Build ERROR detected");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
            });

            it("should detect FAIL keyword", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), "Tests FAIL");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
            });

            it("should count free-form sync issue lines", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), `# Sync Issues

Needs manual reconciliation
`);

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
                expect(result.syncIssuesCount).toBe(1);
            });

            it("should fail closed when sync-issues path cannot be read", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                mkdirSync(join(opencodeDir, "sync-issues.md"));

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
                expect(result.passed).toBe(false);
                expect(result.errors.join("\n")).toContain("Failed to read sync issues");
            });

            it("should ignore checked sync checkboxes as resolved", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), `# Sync Issues

- [x] TypeScript error in file.ts fixed
* [X] Import conflict resolved
`);

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
                expect(result.passed).toBe(true);
            });

            it("should ignore explicit all-clear declarations", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), `# Sync Issues

No open issues. All 10 agents finished.
`);

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
                expect(result.passed).toBe(true);
            });

            it.each(["All clear", "Clean", "Resolved."])("should ignore bare all-clear marker '%s'", (marker) => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), `# Sync Issues\n\n${marker}\n`);

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should still count substantive lines after a resolved marker word", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), "Clean up the database");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
                expect(result.syncIssuesCount).toBe(1);
            });

            it("should still count unchecked sync checkboxes as open", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), `# Sync Issues

- [x] Fixed earlier
- [ ] Still broken
`);

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
                expect(result.syncIssuesCount).toBe(1);
                expect(result.passed).toBe(false);
            });
        });

        describe("Overall verification", () => {
            it("fails when TODO is unreadable even with a passing checklist", () => {
                mkdirSync(join(opencodeDir, "todo.md"));
                writeFileSync(join(opencodeDir, "verification-checklist.md"), "- [x] Build passed");
                const result = verifyMissionCompletion(testDir);
                expect(result.errors.join("\n")).toContain("Failed to read TODO");
                expect(result.passed).toBe(false);
            });
            it("should pass when all conditions met", () => {
                writeFileSync(join(opencodeDir, "todo.md"), `# TODO

- [x] Task 1
- [x] Task 2
`);
                writeFileSync(join(opencodeDir, "sync-issues.md"), "# Sync Issues\n");

                const result = verifyMissionCompletion(testDir);

                expect(result.passed).toBe(true);
                expect(result.todoComplete).toBe(true);
                expect(result.syncIssuesEmpty).toBe(true);
                expect(result.errors.length).toBe(0);
            });

            it("should fail when TODO incomplete even if no sync issues", () => {
                writeFileSync(join(opencodeDir, "todo.md"), `# TODO

- [x] Task 1
- [ ] Task 2
`);

                const result = verifyMissionCompletion(testDir);

                expect(result.passed).toBe(false);
                expect(result.todoComplete).toBe(false);
                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should fail when sync issues exist even if TODO complete", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "sync-issues.md"), "- Unresolved conflict");

                const result = verifyMissionCompletion(testDir);

                expect(result.passed).toBe(false);
                expect(result.todoComplete).toBe(true);
                expect(result.syncIssuesEmpty).toBe(false);
            });

            it("should fail when TODO is incomplete even if checklist is complete", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [ ] Remaining task");
                writeFileSync(join(opencodeDir, "verification-checklist.md"), "- [x] Build passed");

                const result = verifyMissionCompletion(testDir);

                expect(result.passed).toBe(false);
                expect(result.checklistComplete).toBe(true);
                expect(result.errors.join("\n")).toContain("TODO incomplete");
            });

            it("should fail closed when checklist path cannot be read", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                mkdirSync(join(opencodeDir, "verification-checklist.md"));

                const result = verifyMissionCompletion(testDir);

                expect(result.passed).toBe(false);
                expect(result.errors.join("\n")).toContain("Failed to read verification checklist");
            });

            it("should fail closed when an existing checklist is empty", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "verification-checklist.md"), "");

                const result = verifyMissionCompletion(testDir);

                expect(result.checklistPresent).toBe(true);
                expect(result.checklistComplete).toBe(false);
                expect(result.passed).toBe(false);
                expect(result.errors.join("\n")).toContain("Verification checklist is empty");
            });

            it("should fail closed when an existing checklist has no valid items", () => {
                writeFileSync(join(opencodeDir, "todo.md"), "- [x] Done");
                writeFileSync(join(opencodeDir, "verification-checklist.md"), "Build passed");

                const result = verifyMissionCompletion(testDir);

                expect(result.checklistPresent).toBe(true);
                expect(result.passed).toBe(false);
                expect(result.errors.join("\n")).toContain("Verification checklist contains no valid items");
            });
        });
    });

    describe("buildVerificationSummary", () => {
        it("should show PASSED for successful verification", () => {
            const result: VerificationResult = {
                passed: true,
                todoComplete: true,
                todoPresent: true,
                todoProgress: "5/5",
                todoIncomplete: 0,
                syncIssuesEmpty: true,
                syncIssuesCount: 0,
                checklistComplete: false,
                checklistPresent: false,
                checklistProgress: "0/0",
                errors: []
            };

            const summary = buildVerificationSummary(result);

            expect(summary).toContain("✅ PASSED");
            expect(summary).toContain("5/5");
            expect(summary).toContain("clean");
        });

        it("should show FAILED for unsuccessful verification", () => {
            const result: VerificationResult = {
                passed: false,
                todoComplete: false,
                todoPresent: true,
                todoProgress: "3/5",
                todoIncomplete: 2,
                syncIssuesEmpty: false,
                syncIssuesCount: 3,
                checklistComplete: false,
                checklistPresent: false,
                checklistProgress: "0/0",
                errors: ["TODO incomplete", "Sync issues"]
            };

            const summary = buildVerificationSummary(result);

            expect(summary).toContain("❌ FAILED");
            expect(summary).toContain("3/5");
            expect(summary).toContain("3 issues");
        });
    });
});
