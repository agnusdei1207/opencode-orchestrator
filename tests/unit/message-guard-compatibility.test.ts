import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import { describe, expect, it } from "vitest";
import OrchestratorPlugin from "../../src/index.js";
import { MAX_MESSAGE_PART_CHARS, truncateOversizedMessageParts } from "../../src/shared/message/message-guard.js";

const oversized = "a".repeat(MAX_MESSAGE_PART_CHARS * 2);
const imageUri = `data:image/png;base64,${oversized}`;

describe("message guard host compatibility", () => {
    it.each([imageUri, oversized, `data:application/pdf;base64,${oversized}`])("replaces a large file with text instead of corrupting its URI", uri => {
        const result = { type: "content", value: [
            { type: "text", text: "screenshot" },
            { type: "file", uri, mime: "image/png", name: "screenshot" },
        ] };
        const messages = [{ role: "tool", content: [{ type: "tool-result", result }] }];

        expect(truncateOversizedMessageParts(messages)).toBe(1);
        expect(result.value[0]).toEqual({ type: "text", text: "screenshot" });
        expect(result.value[1]).toEqual({ type: "text", text: expect.stringContaining("omitted an oversized inline image/file payload") });
        expect(truncateOversizedMessageParts(messages)).toBe(0);
    });

    it.each(["json", "text", "error"])("caps serialized objects in %s results", type => {
        const result = { type, value: { payload: oversized } as unknown };
        const messages = [{ content: [{ type: "tool-result", result }] }];

        expect(truncateOversizedMessageParts(messages)).toBe(1);
        expect(result.type).toBe(type === "error" ? "error" : "text");
        expect(result.value).toEqual(expect.stringContaining("truncated by message guard"));
        expect(JSON.stringify(result).length).toBeLessThan(oversized.length);
        expect(truncateOversizedMessageParts(messages)).toBe(0);
    });

    it("preserves small files, structured results, and opaque media", () => {
        const content = [
            { type: "tool-result", result: { type: "json", value: { count: 1 } } },
            { type: "tool-result", result: { type: "content", value: [{ type: "file", uri: "https://example.com/a.png", mime: "image/png" }] } },
            { type: "media", media: { source: { type: "base64", data: oversized } } },
            { type: "reasoning", text: "brief", encrypted: oversized },
        ];
        const snapshot = structuredClone(content);
        expect(truncateOversizedMessageParts([{ content }])).toBe(0);
        expect(content).toEqual(snapshot);
    });

    it("ignores unserializable unexpected values without throwing", () => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        const messages = [{ content: [{ type: "tool-result", result: { type: "json", value: cyclic } }] }];
        expect(truncateOversizedMessageParts(messages)).toBe(0);
    });

    it("preserves the threshold and caps reasoning and error strings", () => {
        const content = [
            { type: "text", text: "a".repeat(MAX_MESSAGE_PART_CHARS) },
            { type: "reasoning", text: oversized },
            { type: "tool-result", result: { type: "error", value: oversized } },
        ];
        expect(truncateOversizedMessageParts([{ content }])).toBe(2);
        expect(content[0].text?.length).toBe(MAX_MESSAGE_PART_CHARS);
        expect(content[1].text).toContain("truncated by message guard");
        expect(content[2].result?.type).toBe("error");
        expect(content[2].result?.value).toContain("truncated by message guard");
    });

    it("guards the real V2 context registration", async () => {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-guard-"));
        const hooks = new Map<string, (input: unknown) => Promise<void>>();
        const registration = async () => ({ dispose: async () => {} });
        const context = createHost(directory, hooks, registration);
        const cleanup = await OrchestratorPlugin.setup(context);
        try {
            const result = { type: "text", value: oversized };
            const request = { sessionID: "s1", agent: "Commander", model: { providerID: "p", id: "m" }, system: [], options: {}, messages: [{ role: "tool", content: [{ type: "tool-result", result }] }] };
            expect(hooks.has("context")).toBe(true);
            await hooks.get("context")!(request);
            expect(result.value).toContain("truncated by message guard");
        } finally {
            await cleanup();
            rmSync(directory, { recursive: true, force: true });
        }
    });
});

function createHost(directory: string, hooks: Map<string, (input: unknown) => Promise<void>>, registration: () => Promise<{ dispose: () => Promise<void> }>): Plugin.Context {
    return {
        location: { directory, project: { directory } }, options: {},
        agent: { list: async () => [], transform: registration },
        session: { hook: async (name: string, callback: (input: unknown) => Promise<void>) => {
            hooks.set(name, callback);
            return registration();
        } },
        tool: { hook: registration, transform: registration },
        command: { transform: registration },
        event: { subscribe: async function* () {} },
    } as unknown as Plugin.Context;
}
