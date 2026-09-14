import { describe, expect, it } from "vitest";
import { PROMPT_TAGS, PHILOSOPHY_TAGLINE } from "../../src/shared/index.js";
import { CORE_PHILOSOPHY } from "../../src/agents/prompts/shared/philosophy.js";
import { CONTINUE_INSTRUCTION, CLEANUP_INSTRUCTION, STAGNATION_INTERVENTION } from "../../src/shared/constants/system-messages.js";

describe("retained prompt vocabulary", () => {
    it("keeps runtime continuation consistent with intent, actual tools, and mission schema", () => {
        expect(CONTINUE_INSTRUCTION).toContain("status: completed");
        expect(CONTINUE_INSTRUCTION).toContain("pause");
        expect(CONTINUE_INSTRUCTION).not.toMatch(/DO NOT wait for user|Grade 3|check_background_task/);
        expect(STAGNATION_INTERVENTION).not.toMatch(/check_background_task|read_file|proactively `kill`/);
        expect(CLEANUP_INSTRUCTION).toContain("Preserve existing files");
        expect(CLEANUP_INSTRUCTION).not.toMatch(/or delete it|truncate the log|TODO\.md/);
    });
    it("keeps the identity in the shared philosophy", () => {
        expect(CORE_PHILOSOPHY).toContain(PHILOSOPHY_TAGLINE);
        expect(CORE_PHILOSOPHY).toContain("verification");
    });

    it("keeps matching delimiters for the retained prompt consumers", () => {
        for (const tag of Object.values(PROMPT_TAGS))
            expect(tag.close).toBe(tag.open.replace("<", "</"));
    });
});
