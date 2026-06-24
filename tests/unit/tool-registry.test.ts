import { describe, expect, it, vi } from "vitest";
import { registerAllTools } from "../../src/tools/registry";
import { TOOL_NAMES } from "../../src/shared";
import type { ToolDefinition } from "@opencode-ai/plugin";

vi.mock("@opencode-ai/plugin", () => {
    const schemaValue = {
        optional: () => schemaValue,
        describe: () => schemaValue,
    };
    const mockSchema = {
        string: () => schemaValue,
        boolean: () => schemaValue,
        number: () => schemaValue,
        array: () => schemaValue,
        enum: () => schemaValue,
        object: () => schemaValue,
    };
    const mockTool = vi.fn((config: unknown) => config) as unknown as {
        schema: typeof mockSchema;
    };
    mockTool.schema = mockSchema;
    return { tool: mockTool };
});

describe("registerAllTools", () => {
    it("rejects async agent tools that would override registered tools", () => {
        expect(() => registerAllTools(
            "/tmp/project",
            { [TOOL_NAMES.GREP_SEARCH]: { description: "collision" } as unknown as ToolDefinition },
            {},
        )).toThrow(`Async agent tool conflicts with registered tool: ${TOOL_NAMES.GREP_SEARCH}`);
    });

    it("rejects dynamic tools that would override registered tools", () => {
        expect(() => registerAllTools(
            "/tmp/project",
            {},
            { [TOOL_NAMES.GREP_SEARCH]: { description: "collision" } as unknown as ToolDefinition },
        )).toThrow(`Dynamic tool conflicts with registered tool: ${TOOL_NAMES.GREP_SEARCH}`);
    });

    it("allows async agent tools with unique names", () => {
        const asyncTool = { description: "list agents" } as unknown as ToolDefinition;
        const tools = registerAllTools(
            "/tmp/project",
            { [TOOL_NAMES.LIST_AGENTS]: asyncTool },
            {},
        );

        expect(tools[TOOL_NAMES.LIST_AGENTS]).toBe(asyncTool);
        expect(tools[TOOL_NAMES.GREP_SEARCH]).toBeDefined();
    });

    it("allows dynamic tools with unique names", () => {
        const dynamicTool = { description: "custom" } as unknown as ToolDefinition;
        const tools = registerAllTools(
            "/tmp/project",
            {},
            { custom_tool: dynamicTool },
        );

        expect(tools.custom_tool).toBe(dynamicTool);
        expect(tools[TOOL_NAMES.GREP_SEARCH]).toBeDefined();
    });
});
