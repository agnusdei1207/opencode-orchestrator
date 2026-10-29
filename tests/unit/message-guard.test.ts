/**
 * Message Guard Tests
 */

import { describe, it, expect } from "vitest";
import {
    MAX_MESSAGE_PART_CHARS,
    truncateOversizedMessageParts,
} from "../../src/shared/message/message-guard";

const oversized = "a".repeat(MAX_MESSAGE_PART_CHARS * 2);
const imageDataUri = "data:image/png;base64," + "A".repeat(MAX_MESSAGE_PART_CHARS + 1);

describe("truncateOversizedMessageParts", () => {
    it("truncates an oversized text part in the current message shape", () => {
        const messages = [{ role: "assistant", content: [{ type: "text", text: oversized }] }];

        const count = truncateOversizedMessageParts(messages);

        expect(count).toBe(1);
        const text = (messages[0].content[0] as { text: string }).text;
        expect(text.length).toBeLessThan(oversized.length);
        expect(text).toContain("truncated by message guard");
    });

    it("truncates an oversized tool-result content payload", () => {
        const messages = [{
            role: "tool",
            content: [{
                type: "tool-result",
                id: "call_1",
                name: "read",
                result: { type: "content", value: [{ type: "text", text: oversized }] },
            }],
        }];

        const count = truncateOversizedMessageParts(messages);

        expect(count).toBe(1);
        const part = messages[0].content[0] as { result: { value: { text: string }[] } };
        expect(part.result.value[0].text).toContain("truncated by message guard");
    });

    it("replaces an oversized inline image payload instead of slicing it", () => {
        const messages = [{
            role: "tool",
            content: [{
                type: "tool-result",
                id: "call_2",
                name: "read",
                result: { type: "content", value: [{ type: "text", text: imageDataUri }] },
            }],
        }];

        truncateOversizedMessageParts(messages);

        const part = messages[0].content[0] as { result: { value: { text: string }[] } };
        const text = part.result.value[0].text;
        expect(text).toContain("omitted an oversized inline image/file payload");
        expect(text).not.toContain("data:image/png;base64");
    });

    it("walks only message.content: OpenCode 1 parts/tool.state shapes are not touched", () => {
        const state = { status: "completed", output: oversized };
        const messages = [{ info: { id: "msg_1" }, parts: [{ type: "tool", state }] }];

        expect(truncateOversizedMessageParts(messages)).toBe(0);
        expect(state.output).toBe(oversized);
    });

    it("leaves small parts untouched", () => {
        const messages = [{ role: "user", content: [{ type: "text", text: "hello" }] }];

        expect(truncateOversizedMessageParts(messages)).toBe(0);
        expect((messages[0].content[0] as { text: string }).text).toBe("hello");
    });

    it("leaves media parts untouched so vision input is preserved", () => {
        const messages = [{ role: "user", content: [{ type: "media", mediaType: "image/png", data: imageDataUri }] }];

        expect(truncateOversizedMessageParts(messages)).toBe(0);
    });

    it("ignores unexpected input without throwing", () => {
        expect(truncateOversizedMessageParts(undefined)).toBe(0);
        expect(truncateOversizedMessageParts("not a list")).toBe(0);
        expect(truncateOversizedMessageParts([null, 42, {}])).toBe(0);
    });
});
