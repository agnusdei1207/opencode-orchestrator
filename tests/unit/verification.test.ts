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
    buildVerificationFailurePrompt,
    buildVerificationSummary,
    type VerificationResult
} from "../../src/core/loop/verification.js";
import { PATHS } from "../../src/shared/index.js";

describe("Mission Verification", () => {
    let testDir: string;

    beforeEach(() => {
        // Create temporary test directory
        testDir = join(tmpdir(), `test-verification-${Date.now()}`);
        // Create necessary directories (mission, etc.)
        mkdirSync(join(testDir, ".opencode/mission"), { recursive: true });
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
                writeFileSync(join(testDir, PATHS.TODO), todoContent);

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
                writeFileSync(join(testDir, PATHS.TODO), todoContent);

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
                writeFileSync(join(testDir, PATHS.TODO), todoContent);

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(true);
                expect(result.todoProgress).toBe("2/2");
            });

            it("should fail when no TODO file exists", () => {
                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(false);
                expect(result.passed).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);
                expect(result.errors[0]).toContain("TODO file not found");
            });

            it("should fail when TODO file is empty", () => {
                writeFileSync(join(testDir, PATHS.TODO), "# TODO\n");

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(false);
                expect(result.todoProgress).toBe("0/0");
            });

            it("should handle asterisk list markers", () => {
                const todoContent = `# TODO

* [x] Task 1
* [ ] Task 2
`;
                writeFileSync(join(testDir, PATHS.TODO), todoContent);

                const result = verifyMissionCompletion(testDir);

                expect(result.todoComplete).toBe(false);
                expect(result.todoIncomplete).toBe(1);
            });
        });

        describe("Sync issues verification", () => {
            it("should pass when sync-issues.md doesn't exist", () => {
                writeFileSync(join(testDir, PATHS.TODO), "- [x] Done");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should pass when sync-issues.md is empty", () => {
                writeFileSync(join(testDir, PATHS.TODO), "- [x] Done");
                writeFileSync(join(testDir, PATHS.SYNC_ISSUES), "");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should pass when sync-issues.md only has header", () => {
                writeFileSync(join(testDir, PATHS.TODO), "- [x] Done");
                writeFileSync(join(testDir, PATHS.SYNC_ISSUES), "# Sync Issues\n");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should fail when sync-issues.md has issues", () => {
                writeFileSync(join(testDir, PATHS.TODO), "- [x] Done");
                writeFileSync(join(testDir, PATHS.SYNC_ISSUES), `# Sync Issues

- TypeScript error in file.ts
- Import conflict in module.ts
`);

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
                expect(result.syncIssuesCount).toBeGreaterThan(0);
                expect(result.passed).toBe(false);
            });

            it("should detect ERROR keyword", () => {
                writeFileSync(join(testDir, PATHS.TODO), "- [x] Done");
                writeFileSync(join(testDir, PATHS.SYNC_ISSUES), "Build ERROR detected");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
            });

            it("should detect FAIL keyword", () => {
                writeFileSync(join(testDir, PATHS.TODO), "- [x] Done");
                writeFileSync(join(testDir, PATHS.SYNC_ISSUES), "Tests FAIL");

                const result = verifyMissionCompletion(testDir);

                expect(result.syncIssuesEmpty).toBe(false);
            });
        });

        describe("Overall verification", () => {
            it("should pass when all conditions met", () => {
                writeFileSync(join(testDir, PATHS.TODO), `# TODO

- [x] Task 1
- [x] Task 2
`);
                writeFileSync(join(testDir, PATHS.SYNC_ISSUES), "# Sync Issues\n");

                const result = verifyMissionCompletion(testDir);

                expect(result.passed).toBe(true);
                expect(result.todoComplete).toBe(true);
                expect(result.syncIssuesEmpty).toBe(true);
                expect(result.errors.length).toBe(0);
            });

            it("should fail when TODO incomplete even if no sync issues", () => {
                writeFileSync(join(testDir, PATHS.TODO), `# TODO

- [x] Task 1
- [ ] Task 2
`);

                const result = verifyMissionCompletion(testDir);

                expect(result.passed).toBe(false);
                expect(result.todoComplete).toBe(false);
                expect(result.syncIssuesEmpty).toBe(true);
            });

            it("should fail when sync issues exist even if TODO complete", () => {
                writeFileSync(join(testDir, PATHS.TODO), "- [x] Done");
                writeFileSync(join(testDir, PATHS.SYNC_ISSUES), "- Unresolved conflict");

                const result = verifyMissionCompletion(testDir);

                expect(result.passed).toBe(false);
                expect(result.todoComplete).toBe(true);
                expect(result.syncIssuesEmpty).toBe(false);
            });
        });
    });

    describe("buildVerificationFailurePrompt", () => {
        it("should include all errors in prompt", () => {
            const result: VerificationResult = {
                passed: false,
                todoComplete: false,
                todoProgress: "2/5",
                todoIncomplete: 3,
                syncIssuesEmpty: false,
                syncIssuesCount: 2,
                checklistComplete: false,
                checklistProgress: "0/0",
                errors: ["TODO incomplete: 2/5 (3 remaining)", "Sync issues not resolved: 2 issue(s) remain"]
            };

            const prompt = buildVerificationFailurePrompt(result);

            expect(prompt).toContain("COMPLETION BLOCKED");
            expect(prompt).toContain("TODO incomplete");
            expect(prompt).toContain("2/5");
            expect(prompt).toContain("Sync issues not resolved");
        });

        it("should include status table", () => {
            const result: VerificationResult = {
                passed: false,
                todoComplete: true,
                todoProgress: "5/5",
                todoIncomplete: 0,
                syncIssuesEmpty: false,
                syncIssuesCount: 1,
                checklistComplete: false,
                checklistProgress: "0/0",
                errors: ["Sync issues not resolved"]
            };

            const prompt = buildVerificationFailurePrompt(result);

            expect(prompt).toContain("TODO Progress");
            expect(prompt).toContain("Sync Issues");
            expect(prompt).toContain("✅"); // TODO passed
            expect(prompt).toContain("❌"); // Sync failed
        });
    });

    describe("buildVerificationSummary", () => {
        it("should show PASSED for successful verification", () => {
            const result: VerificationResult = {
                passed: true,
                todoComplete: true,
                todoProgress: "5/5",
                todoIncomplete: 0,
                syncIssuesEmpty: true,
                syncIssuesCount: 0,
                checklistComplete: false,
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
                todoProgress: "3/5",
                todoIncomplete: 2,
                syncIssuesEmpty: false,
                syncIssuesCount: 3,
                checklistComplete: false,
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
