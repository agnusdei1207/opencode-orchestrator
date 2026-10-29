import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentRegistry } from "../../src/core/agents/agent-registry";
import { buildRoutedAgentPrompt } from "../../src/core/agents/manager/prompt-routing";
import { MemoryLevel, MemoryManager } from "../../src/core/memory/memory-manager";
import { AGENT_NAMES } from "../../src/shared";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

const projectDir = "/tmp/prompt-routing-project";

describe("buildRoutedAgentPrompt", () => {
    beforeEach(() => {
        MemoryManager.getInstance(projectDir).import({
            [MemoryLevel.SYSTEM]: [],
            [MemoryLevel.PROJECT]: [],
            [MemoryLevel.MISSION]: [],
            [MemoryLevel.TASK]: [],
        });
    });

    it("keeps built-in agents on their own OpenCode agent route", async () => {
        const routed = await buildRoutedAgentPrompt(
            projectDir,
            AGENT_NAMES.WORKER,
            "Implement the assigned file",
        );

        expect(routed.wireAgent).toBe(AGENT_NAMES.WORKER);
        expect(routed.text).toBe("Implement the assigned file");
        expect(routed.text).not.toContain("### AGENT ROLE:");
        expect(routed).not.toHaveProperty("tools");
    });

    it("routes custom agents through Commander while preserving the custom role prompt", async () => {
        const customAgent = "CustomPromptRoutingAgent";
        AgentRegistry.getInstance(projectDir).registerAgent(customAgent, {
            id: customAgent,
            description: "Custom routing specialist",
            systemPrompt: "CUSTOM ROUTING SYSTEM",
        });

        const routed = await buildRoutedAgentPrompt(projectDir, customAgent, "Continue route audit");

        expect(routed.wireAgent).toBe(AGENT_NAMES.COMMANDER);
        expect(routed.text).toContain("### AGENT ROLE: CustomPromptRoutingAgent");
        expect(routed.text).toContain("Custom routing specialist");
        expect(routed.text).toContain("CUSTOM ROUTING SYSTEM");
        expect(routed.text).toContain("Continue route audit");
        expect(routed.text.indexOf("### AGENT ROLE:"))
            .toBeLessThan(routed.text.indexOf("Continue route audit"));
    });

    it("passes unknown agents through unchanged on the Commander route", async () => {
        const routed = await buildRoutedAgentPrompt(projectDir, "NoSuchAgent", "Plain prompt");

        expect(routed.wireAgent).toBe(AGENT_NAMES.COMMANDER);
        expect(routed.text).toBe("Plain prompt");
    });

    it("prepends relevant memory context before a compact built-in task prompt", async () => {
        MemoryManager.getInstance(projectDir).add(
            MemoryLevel.PROJECT,
            "Implement route audit with prompt routing evidence",
            1,
        );

        const routed = await buildRoutedAgentPrompt(
            projectDir,
            AGENT_NAMES.REVIEWER,
            "Check prompt routing evidence",
        );

        expect(routed.text).toContain("### PROJECT MEMORY");
        expect(routed.text.indexOf("### PROJECT MEMORY"))
            .toBeLessThan(routed.text.indexOf("Check prompt routing evidence"));
        expect(routed.text).not.toContain("### AGENT ROLE:");
    });

    // One OpenCode process can serve several projects at once.
    it("never injects another project's memory into a delegated prompt", async () => {
        const otherProject = "/tmp/prompt-routing-other-project";
        MemoryManager.getInstance(otherProject).add(MemoryLevel.TASK, "Other project secret route audit evidence", 1);

        const routed = await buildRoutedAgentPrompt(projectDir, AGENT_NAMES.REVIEWER, "Check route audit evidence");

        expect(routed.text).not.toContain("Other project secret");
    });
});
