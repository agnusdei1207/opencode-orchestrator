import { describe, expect, it, beforeEach } from "vitest";
import {
    clearEvidence,
    getUnverifiedFiles,
    recordToolEvidence,
} from "../../src/core/loop/evidence.js";

const S = "session-evidence-test";

describe("mission verification advisory", () => {
    beforeEach(() => clearEvidence(S));

    it("records changed files from write/edit tools", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" });
        recordToolEvidence(S, "edit", { path: "src/b.ts" });
        expect(getUnverifiedFiles(S).sort()).toEqual(["src/a.ts", "src/b.ts"]);
    });

    it("records changed files from alternate file argument shapes", () => {
        recordToolEvidence(S, "write", { file_path: "src/a.ts" });
        recordToolEvidence(S, "patch", { files: ["src/b.ts", { path: "src/c.ts" }] });
        recordToolEvidence(S, "edit", { directory: "src/features" });

        expect(getUnverifiedFiles(S).sort()).toEqual([
            "src/a.ts",
            "src/b.ts",
            "src/c.ts",
            "src/features",
        ]);
    });

    it("does not record dry-run write-like tool calls as changes", () => {
        recordToolEvidence(S, "edit", {
            file: "src/a.ts",
            dry_run: true,
        });
        recordToolEvidence(S, "patch", {
            file: "src/b.ts",
            dryRun: true,
        });

        expect(getUnverifiedFiles(S)).toEqual([]);
    });

    it("clears the gap once a verification command runs after the change", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" });
        expect(getUnverifiedFiles(S)).toEqual(["src/a.ts"]);
        recordToolEvidence(S, "shell", { command: "npm test" });
        expect(getUnverifiedFiles(S)).toEqual([]);
    });

    it("recognizes Python compilation as verification", () => {
        recordToolEvidence(S, "write", { filePath: "CompileShaders.py" });
        recordToolEvidence(S, "shell", { command: "python3 -m py_compile CompileShaders.py" });
        expect(getUnverifiedFiles(S)).toEqual([]);
    });

    it("advises only files changed since the latest verification", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" });
        recordToolEvidence(S, "shell", { command: "npm run build" });
        recordToolEvidence(S, "write", { filePath: "src/c.ts" });
        expect(getUnverifiedFiles(S)).toEqual(["src/c.ts"]);
    });

    it("ignores non-verification shell commands", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" });
        recordToolEvidence(S, "shell", { command: "ls -la" });
        expect(getUnverifiedFiles(S)).toEqual(["src/a.ts"]);
    });

    it("ignores tools that are not OpenCode's write or shell tools", () => {
        recordToolEvidence(S, "multiedit", { filePath: "src/a.ts" });
        expect(getUnverifiedFiles(S)).toEqual([]);

        recordToolEvidence(S, "write", { filePath: "src/b.ts" });
        recordToolEvidence(S, "bash", { command: "npm test" });
        expect(getUnverifiedFiles(S)).toEqual(["src/b.ts"]);
    });

    it("returns no files when nothing changed", () => {
        expect(getUnverifiedFiles(S)).toEqual([]);
    });
});
