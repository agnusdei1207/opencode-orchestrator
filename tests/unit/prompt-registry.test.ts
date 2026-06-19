import { describe, expect, it } from "vitest";
import { composePrompt, interpolate } from "../../src/agents/prompts/registry.js";

describe("prompt registry", () => {
    describe("interpolate", () => {
        it("replaces known placeholders", () => {
            expect(interpolate("phase={{phase}} n={{count}}", { phase: "execute", count: 3 })).toBe(
                "phase=execute n=3",
            );
        });

        it("leaves unknown placeholders intact", () => {
            expect(interpolate("keep {{unknown}} here", {})).toBe("keep {{unknown}} here");
        });

        it("is identity on text without placeholders", () => {
            const text = "no placeholders; literal { braces } stay";
            expect(interpolate(text)).toBe(text);
        });
    });

    describe("composePrompt", () => {
        it("joins with blank lines by default (matches legacy .join)", () => {
            expect(composePrompt(["a", "b", "c"])).toBe("a\n\nb\n\nc");
        });

        it("keeps verbose sections under the standard profile", () => {
            const out = composePrompt([{ body: "core" }, { body: "extra", verbose: true }]);
            expect(out).toBe("core\n\nextra");
        });

        it("drops verbose sections under the compact profile", () => {
            const out = composePrompt([{ body: "core" }, { body: "extra", verbose: true }], {
                profile: "compact",
            });
            expect(out).toBe("core");
        });

        it("applies vars to the composed output", () => {
            expect(composePrompt(["role={{role}}"], { vars: { role: "worker" } })).toBe(
                "role=worker",
            );
        });
    });
});
