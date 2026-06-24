import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentRegistry } from "../../src/core/agents/agent-registry";
import { buildRoutedAgentPrompt } from "../../src/core/agents/manager/prompt-routing";
import { MemoryManager } from "../../src/core/memory/memory-manager";
import { MemoryLevel } from "../../src/core/memory/interfaces";
import { AGENT_NAMES, TOOL_NAMES } from "../../src/shared";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("buildRoutedAgentPrompt", () => {
    beforeEach(() => {
        MemoryManager.getInstance().import({
            [MemoryLevel.SYSTEM]: [],
            [MemoryLevel.PROJECT]: [],
            [MemoryLevel.MISSION]: [],
            [MemoryLevel.TASK]: [],
        });
    });

    it("keeps built-in agents on their own OpenCode agent route", async () => {
        const routed = await buildRoutedAgentPrompt(
            AGENT_NAMES.WORKER,
            "Implement the assigned file",
        );

        expect(routed.wireAgent).toBe(AGENT_NAMES.WORKER);
        expect(routed.text).toBe("Implement the assigned file");
        expect(routed.text).not.toContain("### AGENT ROLE:");
        expect(routed.tools).toEqual({
            [TOOL_NAMES.SKILL]: true,
            [TOOL_NAMES.RUN_COMMAND]: true,
        });
    });

    it("routes custom agents through Commander while preserving the custom role prompt", async () => {
        const customAgent = "CustomPromptRoutingAgent";
        AgentRegistry.getInstance().registerAgent(customAgent, {
            id: customAgent,
            description: "Custom routing specialist",
            systemPrompt: "CUSTOM ROUTING SYSTEM",
            canWrite: true,
            canBash: false,
        });

        const routed = await buildRoutedAgentPrompt(customAgent, "Continue route audit");

        expect(routed.wireAgent).toBe(AGENT_NAMES.COMMANDER);
        expect(routed.text).toContain("### AGENT ROLE: CustomPromptRoutingAgent");
        expect(routed.text).toContain("Custom routing specialist");
        expect(routed.text).toContain("CUSTOM ROUTING SYSTEM");
        expect(routed.text).toContain("Continue route audit");
        expect(routed.tools).toEqual(expect.objectContaining({
            [TOOL_NAMES.DELEGATE_TASK]: true,
            [TOOL_NAMES.GET_TASK_RESULT]: true,
            [TOOL_NAMES.LIST_TASKS]: true,
            [TOOL_NAMES.CANCEL_TASK]: true,
            [TOOL_NAMES.SKILL]: true,
            [TOOL_NAMES.RUN_COMMAND]: true,
        }));
    });

    it("prepends relevant memory context before a compact built-in task prompt", async () => {
        MemoryManager.getInstance().add(
            MemoryLevel.PROJECT,
            "Implement route audit with prompt routing evidence",
            1,
        );

        const routed = await buildRoutedAgentPrompt(
            AGENT_NAMES.REVIEWER,
            "Check prompt routing evidence",
        );

        expect(routed.text).toContain("### PROJECT MEMORY");
        expect(routed.text.indexOf("### PROJECT MEMORY"))
            .toBeLessThan(routed.text.indexOf("Check prompt routing evidence"));
        expect(routed.text).not.toContain("### AGENT ROLE:");
    });
});
