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

    it("clears the gap once a verification command runs after the change", () => {
        recordToolEvidence(S, "write", { filePath: "src/a.ts" }, 1);
        expect(getUnverifiedChangeCount(S)).toBe(2 - 1); // 1 unverified
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
