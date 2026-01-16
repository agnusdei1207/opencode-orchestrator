/**
 * Shared Context Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as SharedContext from "../../src/core/session/shared-context";

describe("SharedContext", () => {
    beforeEach(() => {
        SharedContext.clearAll();
    });

    describe("create", () => {
        it("should create a new context", () => {
            const context = SharedContext.create("session_1");

            expect(context.sessionId).toBe("session_1");
            expect(context.documents.size).toBe(0);
            expect(context.findings.length).toBe(0);
            expect(context.decisions.size).toBe(0);
        });

        it("should create context with parent", () => {
            SharedContext.create("parent_1");
            const childContext = SharedContext.create("child_1", "parent_1");

            expect(childContext.parentId).toBe("parent_1");
        });
    });

    describe("get and getMerged", () => {
        it("should get context by session ID", () => {
            SharedContext.create("session_1");
            const retrieved = SharedContext.get("session_1");

            expect(retrieved).not.toBeUndefined();
            expect(retrieved?.sessionId).toBe("session_1");
        });

        it("should return undefined for non-existent session", () => {
            expect(SharedContext.get("nonexistent")).toBeUndefined();
        });

        it("should merge parent context into child", () => {
            SharedContext.create("parent_1");
            SharedContext.addDocument("parent_1", {
                url: "https://example.com/doc1",
                filename: "doc1.md",
                title: "Parent Doc",
                cachedAt: new Date(),
            });

            SharedContext.create("child_1", "parent_1");
            SharedContext.addDocument("child_1", {
                url: "https://example.com/doc2",
                filename: "doc2.md",
                title: "Child Doc",
                cachedAt: new Date(),
            });

            const merged = SharedContext.getMerged("child_1");
            expect(merged?.documents.size).toBe(2);
        });
    });

    describe("addDocument", () => {
        it("should add document to context", () => {
            SharedContext.create("session_1");
            SharedContext.addDocument("session_1", {
                url: "https://example.com/doc",
                filename: "example.md",
                title: "Example Doc",
                cachedAt: new Date(),
            });

            const context = SharedContext.get("session_1");
            expect(context?.documents.size).toBe(1);
            expect(context?.documents.get("example.md")?.title).toBe("Example Doc");
        });
    });

    describe("addFinding", () => {
        it("should add finding with auto-generated ID", () => {
            SharedContext.create("session_1");
            SharedContext.addFinding("session_1", {
                content: "Found important pattern",
                source: "grep search",
                category: "pattern",
            });

            const context = SharedContext.get("session_1");
            expect(context?.findings.length).toBe(1);
            expect(context?.findings[0].id).toMatch(/^finding_/);
            expect(context?.findings[0].category).toBe("pattern");
        });
    });

    describe("addDecision", () => {
        it("should record a decision", () => {
            SharedContext.create("session_1");
            SharedContext.addDecision("session_1", {
                question: "Which framework to use?",
                answer: "Next.js",
                rationale: "Best for SSR and routing",
            });

            const context = SharedContext.get("session_1");
            expect(context?.decisions.size).toBe(1);
        });
    });

    describe("getChildren", () => {
        it("should return child session IDs", () => {
            SharedContext.create("parent_1");
            SharedContext.create("child_1", "parent_1");
            SharedContext.create("child_2", "parent_1");

            const children = SharedContext.getChildren("parent_1");
            expect(children.length).toBe(2);
            expect(children).toContain("child_1");
            expect(children).toContain("child_2");
        });
    });

    describe("getSummary", () => {
        it("should generate summary string", () => {
            SharedContext.create("session_1");
            SharedContext.addDocument("session_1", {
                url: "https://example.com/doc",
                filename: "example.md",
                title: "Example Doc",
                cachedAt: new Date(),
            });
            SharedContext.addFinding("session_1", {
                content: "Important finding",
                source: "research",
                category: "api",
            });

            const summary = SharedContext.getSummary("session_1");
            expect(summary).toContain("Cached Documents");
            expect(summary).toContain("Key Findings");
            expect(summary).toContain("Example Doc");
        });
    });

    describe("getStats", () => {
        it("should return correct statistics", () => {
            SharedContext.create("session_1");
            SharedContext.addDocument("session_1", {
                url: "https://example.com/doc",
                filename: "example.md",
                title: "Example Doc",
                cachedAt: new Date(),
            });
            SharedContext.addFinding("session_1", {
                content: "Finding 1",
                source: "test",
                category: "pattern",
            });

            const stats = SharedContext.getStats();
            expect(stats.totalContexts).toBe(1);
            expect(stats.totalDocuments).toBe(1);
            expect(stats.totalFindings).toBe(1);
        });
    });
});
