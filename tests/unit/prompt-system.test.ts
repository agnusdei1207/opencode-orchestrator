/**
 * Prompt System Tests
 * 
 * Tests for:
 * - Prompt tag structure
 * - Philosophy constants
 * - Mandate exports
 * - Agent prompt composition
 */

import { describe, it, expect } from "vitest";

import {
    PROMPT_TAGS,
    PHILOSOPHY_PHASES,
    PHILOSOPHY_TAGLINE,
    PHILOSOPHY_QUOTE,
    PHASE_0_DIRECT_DISCOVERY,
    PHASE_1_THINK_ANALYSIS,
    PHASE_5_MSVP,
    HPFA_RULES,
    AGENT_NAMES,
    PATHS,
} from "../../src/shared";

describe("Prompt System", () => {
    // ========================================================================
    // PROMPT_TAGS Structure
    // ========================================================================

    describe("PROMPT_TAGS structure", () => {
        it("should have open and close tags for all entries", () => {
            const requiredTags = [
                "ROLE",
                "FORBIDDEN_ACTIONS",
                "REQUIRED_ACTIONS",
                "EXECUTION_STRATEGY",
                "CORE_PHILOSOPHY",
                "ENVIRONMENT_DISCOVERY",
            ];

            for (const tagName of requiredTags) {
                const tag = PROMPT_TAGS[tagName as keyof typeof PROMPT_TAGS];
                expect(tag, `Missing tag: ${tagName}`).toBeDefined();
                expect(tag.open, `Missing open for: ${tagName}`).toBeDefined();
                expect(tag.close, `Missing close for: ${tagName}`).toBeDefined();
                expect(tag.open).toContain("<");
                expect(tag.close).toContain("</");
            }
        });

        it("should have matching tag names in open and close", () => {
            for (const [key, tag] of Object.entries(PROMPT_TAGS)) {
                if (typeof tag === "object" && "open" in tag && "close" in tag) {
                    const openMatch = tag.open.match(/<(\w+)/);
                    const closeMatch = tag.close.match(/<\/(\w+)/);

                    if (openMatch && closeMatch) {
                        expect(
                            openMatch[1],
                            `Mismatched tags for ${key}`
                        ).toBe(closeMatch[1]);
                    }
                }
            }
        });
    });

    // ========================================================================
    // Philosophy Constants
    // ========================================================================

    describe("philosophy constants", () => {
        it("should define all philosophy phases", () => {
            expect(PHILOSOPHY_PHASES.EXPLORE).toBeDefined();
            expect(PHILOSOPHY_PHASES.LEARN).toBeDefined();
            expect(PHILOSOPHY_PHASES.ADAPT).toBeDefined();
            expect(PHILOSOPHY_PHASES.ACT).toBeDefined();
        });

        it("should have non-empty philosophy tagline", () => {
            expect(PHILOSOPHY_TAGLINE).toBeDefined();
            expect(PHILOSOPHY_TAGLINE.length).toBeGreaterThan(0);
        });

        it("should have non-empty philosophy quote", () => {
            expect(PHILOSOPHY_QUOTE).toBeDefined();
            expect(PHILOSOPHY_QUOTE.length).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // Phase Mandates
    // ========================================================================

    describe("phase mandates", () => {
        it("should export PHASE_0_DIRECT_DISCOVERY", () => {
            expect(PHASE_0_DIRECT_DISCOVERY).toBeDefined();
            expect(typeof PHASE_0_DIRECT_DISCOVERY).toBe("string");
            expect(PHASE_0_DIRECT_DISCOVERY.length).toBeGreaterThan(100);
        });

        it("should contain direct discovery instructions (not scouts)", () => {
            expect(PHASE_0_DIRECT_DISCOVERY).toContain("Direct");
            // Should NOT contain scout swarm references
            expect(PHASE_0_DIRECT_DISCOVERY).not.toContain("Scout Swarm");
            expect(PHASE_0_DIRECT_DISCOVERY).not.toContain("LAUNCH Parallel Scouts");
        });

        it("should export PHASE_1_THINK_ANALYSIS", () => {
            expect(PHASE_1_THINK_ANALYSIS).toBeDefined();
            expect(PHASE_1_THINK_ANALYSIS).toContain("ANALYZE");
            expect(PHASE_1_THINK_ANALYSIS).toContain("SCOPE");
        });

        it("should export PHASE_5_MSVP with Commander-centric spawning", () => {
            expect(PHASE_5_MSVP).toBeDefined();
            expect(PHASE_5_MSVP).toContain("STAGE 1");
            expect(PHASE_5_MSVP).toContain("STAGE 2");
            // Commander spawns all agents
            expect(PHASE_5_MSVP).toContain("Commander spawns");
            expect(PHASE_5_MSVP).not.toContain("PARALLEL DISCOVERY");
        });

        it("should export HPFA_RULES with terminal node concept", () => {
            expect(HPFA_RULES).toBeDefined();
            expect(HPFA_RULES).toContain("TERMINAL");
            expect(HPFA_RULES).toContain("Speculative Racing");
        });
    });

    // ========================================================================
    // Agent Names
    // ========================================================================

    describe("agent names", () => {
        it("should define all five agents", () => {
            expect(AGENT_NAMES.COMMANDER).toBeDefined();
            expect(AGENT_NAMES.PLANNER).toBeDefined();
            expect(AGENT_NAMES.WORKER).toBeDefined();
            expect(AGENT_NAMES.REVIEWER).toBeDefined();
            expect(AGENT_NAMES.MASTER_REVIEWER).toBeDefined();
        });

        it("should have unique agent names", () => {
            const names = [
                AGENT_NAMES.COMMANDER,
                AGENT_NAMES.PLANNER,
                AGENT_NAMES.WORKER,
                AGENT_NAMES.REVIEWER,
                AGENT_NAMES.MASTER_REVIEWER,
            ];
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(names.length);
        });
    });

    // ========================================================================
    // Path Constants
    // ========================================================================

    describe("path constants", () => {
        it("should define all required paths", () => {
            expect(PATHS.OPENCODE).toBeDefined();
            expect(PATHS.TODO).toBeDefined();
            expect(PATHS.CONTEXT).toBeDefined();
            expect(PATHS.WORK_LOG).toBeDefined();
            expect(PATHS.SYNC_ISSUES).toBeDefined();
        });

        it("should have consistent path structure", () => {
            // All paths should start with .opencode (except OPENCODE itself)
            expect(PATHS.TODO).toContain(PATHS.OPENCODE);
            expect(PATHS.CONTEXT).toContain(PATHS.OPENCODE);
            expect(PATHS.WORK_LOG).toContain(PATHS.OPENCODE);
        });
    });

    // ========================================================================
    // Prompt Length Sanity
    // ========================================================================

    describe("prompt length sanity", () => {
        it("should have reasonable prompt lengths", () => {
            // Mandates should be concise but informative
            expect(PHASE_0_DIRECT_DISCOVERY.length).toBeLessThan(2000);
            expect(PHASE_1_THINK_ANALYSIS.length).toBeLessThan(2000);
            expect(PHASE_5_MSVP.length).toBeLessThan(1000);
            expect(HPFA_RULES.length).toBeLessThan(1000);
        });
    });
});
