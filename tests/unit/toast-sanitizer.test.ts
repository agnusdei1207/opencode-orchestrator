import { describe, expect, it } from "vitest";
import {
    sanitizeToastInline,
    sanitizeToastMessage,
    sanitizeToastTitle,
} from "../../src/core/notification/toast-sanitizer";

describe("toast-sanitizer", () => {
    it("removes terminal escape sequences and control bytes from inline text", () => {
        const value = "build\u001b[31m failed\u001b[0m\u0007\nnext";

        expect(sanitizeToastInline(value)).toBe("build failed next");
    });

    it("limits multiline messages to a safe number of lines", () => {
        const value = Array.from({ length: 20 }, (_, index) => `line-${index + 1}`).join("\n");
        const result = sanitizeToastMessage(value, 600, 4);

        expect(result).toContain("line-1");
        expect(result).toContain("line-4");
        expect(result).not.toContain("line-5");
    });

    it("forces toast titles to one safe line", () => {
        const value = "Title\nwith\tbreaks\u001b]8;;https://example.com\u0007";

        expect(sanitizeToastTitle(value)).toBe("Title with breaks");
    });
});
