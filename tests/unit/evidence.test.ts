import { describe, expect, it, beforeEach } from "vitest";
import {
    clearEvidence,
    getChangedFiles,
    getUnverifiedChangeCount,
    recordToolEvidence,
} from "../../src/core/loop/evidence.js";

const S = "session-evidence-test";

describe("mission evidence (wiring gate)", () => {
    beforeEach(() => clearEvidence(S));

    it("records changed files from write/edit tools", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" }, 1);
        recordToolEvidence(S, "edit", { path: "src/b.ts" }, 2);
        expect(getChangedFiles(S).sort()).toEqual(["src/a.ts", "src/b.ts"]);
        expect(getUnverifiedChangeCount(S)).toBe(2);
    });

    it("records changed files from alternate file argument shapes", () => {
        recordToolEvidence(S, "write", { file_path: "src/a.ts" }, 1);
        recordToolEvidence(S, "multiedit", { files: ["src/b.ts", { path: "src/c.ts" }] }, 2);
        recordToolEvidence(S, "sed_replace", { directory: "src/features" }, 3);

        expect(getChangedFiles(S).sort()).toEqual([
            "src/a.ts",
            "src/b.ts",
            "src/c.ts",
            "src/features",
        ]);
        expect(getUnverifiedChangeCount(S)).toBe(4);
    });

    it("does not record dry-run write-like tool calls as changes", () => {
        recordToolEvidence(S, "sed_replace", {
            file: "src/a.ts",
            dry_run: true,
        }, 1);
        recordToolEvidence(S, "sed_replace", {
            file: "src/b.ts",
            dryRun: true,
        }, 2);

        expect(getChangedFiles(S)).toEqual([]);
        expect(getUnverifiedChangeCount(S)).toBe(0);
    });

    it("clears the gap once a verification command runs after the change", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" }, 1);
        expect(getUnverifiedChangeCount(S)).toBe(1);
        recordToolEvidence(S, "bash", { command: "npm test" }, 2);
        expect(getUnverifiedChangeCount(S)).toBe(0);
    });

    it("reopens the gap when a change happens after verification", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" }, 1);
        recordToolEvidence(S, "bash", { command: "npm run build" }, 2);
        expect(getUnverifiedChangeCount(S)).toBe(0);
        recordToolEvidence(S, "write", { filePath: "src/c.ts" }, 3);
        expect(getUnverifiedChangeCount(S)).toBe(2);
    });

    it("ignores non-verification shell commands", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" }, 1);
        recordToolEvidence(S, "bash", { command: "ls -la" }, 2);
        expect(getUnverifiedChangeCount(S)).toBe(1);
    });

    it("returns zero when nothing changed", () => {
        expect(getUnverifiedChangeCount(S)).toBe(0);
    });
});
