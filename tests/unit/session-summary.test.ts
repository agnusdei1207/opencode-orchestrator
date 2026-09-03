import { describe, it, expect, beforeEach } from "vitest";
import { getSummary } from "../../src/core/session/summary.js";
import * as store from "../../src/core/session/store.js";

describe("Session Summary", () => {
    beforeEach(() => {
        store.clearAll();
    });

    it("returns empty string when session context is missing", () => {
        const summary = getSummary("nonexistent");
        expect(summary).toBe("");
    });

    it("formats summary with documents, findings, and decisions", () => {
        store.create("session_1");
        store.addDocument("session_1", {
            filename: "spec.md",
            title: "System Spec",
            url: "https://example.com/spec",
            size: 500,
            fetchedAt: new Date(),
        });
        store.addFinding("session_1", {
            category: "architecture",
            content: "Use layered clean architecture",
            timestamp: new Date(),
        });
        store.addDecision("session_1", {
            question: "Database selection?",
            answer: "SQLite",
            timestamp: new Date(),
        });

        const summary = getSummary("session_1");

        expect(summary).toContain("## Cached Documents");
        expect(summary).toContain("- System Spec: .opencode/docs/spec.md");
        expect(summary).toContain("## Key Findings");
        expect(summary).toContain("- [architecture] Use layered clean architecture");
        expect(summary).toContain("## Decisions Made");
        expect(summary).toContain("- Q: Database selection?");
        expect(summary).toContain("  A: SQLite");
    });
});
