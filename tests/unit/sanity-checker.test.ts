import { describe, expect, it } from "vitest";
import { checkOutputSanity, SEVERITY } from "../../src/utils/sanity/index";

describe("checkOutputSanity", () => {
    it("treats short or empty text as healthy", () => {
        expect(checkOutputSanity("").isHealthy).toBe(true);
        expect(checkOutputSanity("short text").severity).toBe(SEVERITY.OK);
    });

    it("detects single character repetition", () => {
        const result = checkOutputSanity("prefix " + "S".repeat(16) + " suffix with enough length for detector");

        expect(result).toEqual({
            isHealthy: false,
            reason: "Single character repetition detected",
            severity: SEVERITY.CRITICAL,
        });
    });

    it("detects short repeated pattern loops", () => {
        const result = checkOutputSanity("abcdef".repeat(9));

        expect(result).toEqual({
            isHealthy: false,
            reason: "Pattern loop detected",
            severity: SEVERITY.CRITICAL,
        });
    });

    it("detects low information density", () => {
        const block = "a".repeat(15) + "b".repeat(15) + "c".repeat(15) + "d".repeat(15);
        const result = checkOutputSanity(block.repeat(4));

        expect(result).toEqual({
            isHealthy: false,
            reason: "Low information density",
            severity: SEVERITY.CRITICAL,
        });
    });

    it("detects visual gibberish from box drawing characters", () => {
        const boxFlood = Array.from(
            { length: 120 },
            (_, index) => String.fromCharCode(0x2500 + (index % 80)),
        ).join("") + "plain text ".repeat(20);

        const result = checkOutputSanity(boxFlood);

        expect(result).toEqual({
            isHealthy: false,
            reason: "Visual gibberish detected",
            severity: SEVERITY.CRITICAL,
        });
    });

    it("detects excessive line repetition as a warning", () => {
        const repeatedLines = Array.from(
            { length: 12 },
            (_, index) => index % 2 === 0 ? "repeat line alpha" : "repeat line beta",
        ).join("\n");

        const result = checkOutputSanity(repeatedLines);

        expect(result).toEqual({
            isHealthy: false,
            reason: "Excessive line repetition",
            severity: SEVERITY.WARNING,
        });
    });

    it("detects CJK character spam", () => {
        const cjkSpam = Array.from(
            { length: 225 },
            (_, index) => String.fromCharCode(0x4e00 + (index % 9)),
        ).join("");

        const result = checkOutputSanity(cjkSpam);

        expect(result).toEqual({
            isHealthy: false,
            reason: "CJK character spam detected",
            severity: SEVERITY.CRITICAL,
        });
    });

    it("keeps varied long text healthy", () => {
        const text = [
            "The implementation completed successfully with tests passing.",
            "It includes varied words, punctuation, and enough detail to avoid repetition.",
            "No warning pattern should be raised for this ordinary response.",
        ].join(" ");

        expect(checkOutputSanity(text)).toEqual({
            isHealthy: true,
            severity: SEVERITY.OK,
        });
    });
});
