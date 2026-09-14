import { describe, expect, it } from "vitest";
import { registerAllTools } from "../../src/tools/registry.js";
import { TOOL_NAMES } from "../../src/shared/index.js";
import type { ToolDefinition } from "@opencode-ai/plugin";

const taskTool: ToolDefinition = { description: "test task", args: {}, execute: async () => "done" };

describe("registerAllTools", () => {
    it("leaves web capabilities to the host without shadowing its tools", () => {
        const tools = registerAllTools("/tmp/project", {});
        for (const name of ["webfetch", "websearch", "cache_docs", "codesearch", "call_agent"])
            expect(tools).not.toHaveProperty(name);
    });

    it("rejects task tools that collide with an owned tool", () => {
        expect(() => registerAllTools("/tmp/project", { [TOOL_NAMES.GREP_SEARCH]: taskTool }))
            .toThrow(`Async agent tool conflicts with registered tool: ${TOOL_NAMES.GREP_SEARCH}`);
    });

    it("retains the actual task tools and remaining owned utilities", async () => {
        const tools = registerAllTools("/tmp/project", { [TOOL_NAMES.DELEGATE_TASK]: taskTool });
        expect(tools[TOOL_NAMES.DELEGATE_TASK]).toBe(taskTool);
        expect(tools[TOOL_NAMES.GREP_SEARCH]).toBeDefined();
        expect(await tools[TOOL_NAMES.DELEGATE_TASK].execute({}, {} as never)).toBe("done");
    });
});
