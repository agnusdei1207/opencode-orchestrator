import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KnowledgeContextProvider } from "../../../src/core/knowledge/context-provider.js";

describe("KnowledgeContextProvider role weighting", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(tmpdir(), "knowledge-role-"));
        const docs = path.join(testDir, "docs");
        fs.mkdirSync(docs, { recursive: true });
        // Lexical-only match: query term repeated in body, no tags, no links.
        fs.writeFileSync(
            path.join(docs, "lexdoc.md"),
            "# Lex\n\nalpha alpha alpha alpha alpha alpha details.\n",
        );
        // Tag-only match: query term is a frontmatter tag, body unrelated, no links.
        fs.writeFileSync(
            path.join(docs, "tagdoc.md"),
            "---\ntags: [alpha]\n---\n\n# Tag\n\nunrelated beta gamma delta content.\n",
        );
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    it("ranks the lexical doc first for a worker (lexical-biased) role", () => {
        const prompt = new KnowledgeContextProvider().buildPrompt(testDir, "alpha", "worker");
        expect(prompt).not.toBeNull();
        expect(prompt!.indexOf("lexdoc")).toBeLessThan(prompt!.indexOf("tagdoc"));
    });

    it("ranks the tag doc first for a planner (tag/graph-biased) role", () => {
        const prompt = new KnowledgeContextProvider().buildPrompt(testDir, "alpha", "planner");
        expect(prompt).not.toBeNull();
        expect(prompt!.indexOf("tagdoc")).toBeLessThan(prompt!.indexOf("lexdoc"));
    });
});
