/**
 * Agent Definition Tests
 * 
 * Tests for:
 * - Agent definition structure
 * - System prompt composition
 * - Agent capabilities
 */

import { describe, it, expect } from "vitest";

import { AGENTS } from "../../src/agents/definitions";
import { commander } from "../../src/agents/commander";
import { AGENT_NAMES } from "../../src/shared";

describe("Agent Definitions", () => {
    // ========================================================================
    // AGENTS Registry
    // ========================================================================

    describe("AGENTS registry", () => {
        it("should export all four agents", () => {
            expect(AGENTS[AGENT_NAMES.COMMANDER]).toBeDefined();
            expect(AGENTS[AGENT_NAMES.PLANNER]).toBeDefined();
            expect(AGENTS[AGENT_NAMES.WORKER]).toBeDefined();
            expect(AGENTS[AGENT_NAMES.REVIEWER]).toBeDefined();
        });

        it("should have exactly 4 agents", () => {
            expect(Object.keys(AGENTS)).toHaveLength(4);
        });
    });

    // ========================================================================
    // Agent Definition Structure
    // ========================================================================

    describe("agent definition structure", () => {
        const agentNames = Object.keys(AGENTS);

        it("should have required fields for all agents", () => {
            for (const name of agentNames) {
                const agent = AGENTS[name];
                expect(agent.id, `Missing id for ${name}`).toBeDefined();
                expect(agent.description, `Missing description for ${name}`).toBeDefined();
                expect(agent.systemPrompt, `Missing systemPrompt for ${name}`).toBeDefined();
                expect(typeof agent.canWrite, `Missing canWrite for ${name}`).toBe("boolean");
                expect(typeof agent.canBash, `Missing canBash for ${name}`).toBe("boolean");
            }
        });

        it("should have non-empty system prompts", () => {
            for (const name of agentNames) {
                const agent = AGENTS[name];
                expect(agent.systemPrompt.length).toBeGreaterThan(100);
            }
        });

        it("should have matching id and registry key", () => {
            for (const [key, agent] of Object.entries(AGENTS)) {
                expect(agent.id).toBe(key);
            }
        });
    });

    // ========================================================================
    // Commander Agent
    // ========================================================================

    describe("Commander agent", () => {
        it("should be the main orchestrator", () => {
            expect(commander.id).toBe(AGENT_NAMES.COMMANDER);
        });

        it("should have write and bash capabilities", () => {
            expect(commander.canWrite).toBe(true);
            expect(commander.canBash).toBe(true);
        });

        it("should include core philosophy in system prompt", () => {
            expect(commander.systemPrompt).toContain("Core Philosophy");
        });

        it("should include execution strategy", () => {
            expect(commander.systemPrompt).toContain("execution_strategy");
        });

        it("should NOT use parallel scouts (direct discovery instead)", () => {
            // After refactoring, Commander should use direct discovery
            expect(commander.systemPrompt).not.toContain("LAUNCH Parallel Scouts");
            expect(commander.systemPrompt).toContain("Direct Discovery");
        });
    });

    // ========================================================================
    // Planner Agent
    // ========================================================================

    describe("Planner agent", () => {
        const planner = AGENTS[AGENT_NAMES.PLANNER];

        it("should have planning role", () => {
            expect(planner.id).toBe(AGENT_NAMES.PLANNER);
            expect(planner.description).toContain("plan");
        });

        it("should include environment discovery for research", () => {
            // Planner needs ENVIRONMENT_DISCOVERY for research tasks
            expect(planner.systemPrompt).toContain("environment_discovery");
        });

        it("should include TODO format instructions", () => {
            expect(planner.systemPrompt).toContain("TODO");
        });
    });

    // ========================================================================
    // Worker Agent
    // ========================================================================

    describe("Worker agent", () => {
        const worker = AGENTS[AGENT_NAMES.WORKER];

        it("should have implementation role", () => {
            expect(worker.id).toBe(AGENT_NAMES.WORKER);
        });

        it("should have write and bash capabilities", () => {
            expect(worker.canWrite).toBe(true);
            expect(worker.canBash).toBe(true);
        });

        it("should include TDD workflow", () => {
            expect(worker.systemPrompt).toContain("TDD");
        });

        it("should include quality guidelines", () => {
            expect(worker.systemPrompt).toContain("quality");
        });
    });

    // ========================================================================
    // Reviewer Agent
    // ========================================================================

    describe("Reviewer agent", () => {
        const reviewer = AGENTS[AGENT_NAMES.REVIEWER];

        it("should have verification role", () => {
            expect(reviewer.id).toBe(AGENT_NAMES.REVIEWER);
        });

        it("should include verification instructions", () => {
            expect(reviewer.systemPrompt).toContain("verification");
        });

        it("should be able to mark TODO items", () => {
            expect(reviewer.systemPrompt).toContain("[x]");
        });

        it("should NOT use parallel scouts for integration (direct reading)", () => {
            // After refactoring, Reviewer reads directly
            expect(reviewer.systemPrompt).not.toContain("Integration Scout");
            expect(reviewer.systemPrompt).toContain("directly");
        });
    });

    // ========================================================================
    // System Prompt Quality
    // ========================================================================

    describe("system prompt quality", () => {
        it("should have reasonable prompt sizes", () => {
            for (const [name, agent] of Object.entries(AGENTS)) {
                // Prompts should be substantial but not excessive
                expect(agent.systemPrompt.length, `${name} prompt too short`).toBeGreaterThan(500);
                expect(agent.systemPrompt.length, `${name} prompt too long`).toBeLessThan(50000);
            }
        });

        it("should not have duplicate content", () => {
            for (const [name, agent] of Object.entries(AGENTS)) {
                // Check for obvious duplicates (same section appearing twice)
                const lines = agent.systemPrompt.split("\n").filter(l => l.trim().length > 50);
                const uniqueLines = new Set(lines);
                const dupeRatio = lines.length / uniqueLines.size;
                expect(dupeRatio, `${name} has too many duplicate lines`).toBeLessThan(1.5);
            }
        });

        it("should reference shared paths", () => {
            for (const [name, agent] of Object.entries(AGENTS)) {
                // All agents should know about .opencode paths
                expect(
                    agent.systemPrompt.includes(".opencode"),
                    `${name} should reference .opencode`
                ).toBe(true);
            }
        });
    });

    // ========================================================================
    // Agent Hierarchy
    // ========================================================================

    describe("agent hierarchy", () => {
        it("should define Commander as top-level orchestrator", () => {
            const commander = AGENTS[AGENT_NAMES.COMMANDER];
            expect(commander.systemPrompt).toContain("orchestrat");
        });

        it("should define Planner, Worker, Reviewer as specialized subagents", () => {
            const subagents = [
                AGENTS[AGENT_NAMES.PLANNER],
                AGENTS[AGENT_NAMES.WORKER],
                AGENTS[AGENT_NAMES.REVIEWER],
            ];

            for (const subagent of subagents) {
                // Subagents should NOT have CORE_PHILOSOPHY tag (Commander only)
                const hasCorePhilosophyTag = subagent.systemPrompt.includes("<core_philosophy>");
                expect(hasCorePhilosophyTag).toBe(false);
            }
        });
    });
});
