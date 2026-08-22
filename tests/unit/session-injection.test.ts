import { describe, it, expect } from "vitest";
import { syntheticTextPart, syntheticTextParts } from "../../src/core/session/injection";

/**
 * Regression coverage for issue #37: orchestrator-authored prompts rendered in
 * the TUI as if the user had typed them. OpenCode hides text parts flagged
 * `synthetic` from the transcript while still passing them to the model
 * (`MessageV2.toModelMessage` filters on `ignored`, never on `synthetic`).
 */
describe("synthetic prompt parts (issue #37)", () => {
    it("marks a single injected prompt as synthetic", () => {
        expect(syntheticTextPart("continue the mission")).toEqual({
            type: "text",
            text: "continue the mission",
            synthetic: true,
        });
    });

    it("marks every prompt in a batch as synthetic", () => {
        const parts = syntheticTextParts(["first", "second"]);

        expect(parts).toHaveLength(2);
        expect(parts.every(part => part.synthetic === true)).toBe(true);
        expect(parts.map(part => part.text)).toEqual(["first", "second"]);
    });

    it("preserves the prompt text verbatim so the model sees it unchanged", () => {
        const prompt = "<mission_loop iteration=\"3\">\nMISSION NOT COMPLETE\n</mission_loop>";

        expect(syntheticTextPart(prompt).text).toBe(prompt);
    });

    it("returns an empty batch for no prompts", () => {
        expect(syntheticTextParts([])).toEqual([]);
    });
});
