import { describe, expect, it, vi } from "vitest";
import { createConfigHandler } from "../../src/plugin-handlers/config-handler.js";
import { AGENT_NAMES } from "../../src/shared/index.js";

describe("createConfigHandler", () => {
    it("inherits global permission config for every orchestrator agent", async () => {
        const config = {
            permission: {
                question: "allow",
                edit: "deny",
                bash: {
                    "*": "ask",
                    "git status*": "allow",
                },
            },
        };

        await createConfigHandler()(config);

        for (const agentName of Object.values(AGENT_NAMES)) {
            expect(config.agent[agentName].permission).toEqual(config.permission);
        }
    });

    it("preserves user model and agent-specific permission overrides", async () => {
        const config = {
            model: "anthropic/claude-sonnet-4-5-20250929",
            permission: {
                question: "allow",
                edit: "deny",
                bash: "ask",
            },
            agent: {
                [AGENT_NAMES.COMMANDER]: {
                    model: "opencode/gpt-5.1-codex",
                    permission: {
                        question: "deny",
                        websearch: "allow",
                    },
                    temperature: 0.2,
                },
                [AGENT_NAMES.WORKER]: {
                    model: "anthropic/claude-opus-4-5-20251101",
                },
            },
        };

        await createConfigHandler()(config);

        expect(config.agent[AGENT_NAMES.COMMANDER].mode).toBe("primary");
        expect(config.agent[AGENT_NAMES.COMMANDER].model).toBe("opencode/gpt-5.1-codex");
        expect(config.agent[AGENT_NAMES.COMMANDER].temperature).toBe(0.2);
        expect(config.agent[AGENT_NAMES.COMMANDER].permission).toEqual({
            question: "deny",
            edit: "deny",
            bash: "ask",
            websearch: "allow",
        });
        expect(config.agent[AGENT_NAMES.WORKER].model).toBe("anthropic/claude-opus-4-5-20251101");
        expect(config.agent[AGENT_NAMES.WORKER].permission).toEqual(config.permission);
    });

    it("merges string global permission with object agent permissions", async () => {
        const config = {
            permission: "allow",
            agent: {
                [AGENT_NAMES.COMMANDER]: {
                    permission: {
                        edit: "deny",
                    },
                },
            },
        };

        await createConfigHandler()(config);

        expect(config.agent[AGENT_NAMES.COMMANDER].permission).toEqual({
            "*": "allow",
            edit: "deny",
        });
        expect(config.agent[AGENT_NAMES.PLANNER].permission).toBe("allow");
    });

    it("emits only documented OpenCode agent config fields for generated agents", async () => {
        const config = {};

        await createConfigHandler()(config);

        expect(config.agent[AGENT_NAMES.COMMANDER]).not.toHaveProperty("maxTokens");
        expect(config.agent[AGENT_NAMES.COMMANDER]).not.toHaveProperty("thinking");
        expect(config.agent[AGENT_NAMES.COMMANDER]).not.toHaveProperty("tools");
        expect(config.agent[AGENT_NAMES.PLANNER]).not.toHaveProperty("maxTokens");
        expect(config.agent[AGENT_NAMES.PLANNER]).not.toHaveProperty("tools");
        expect(config.agent[AGENT_NAMES.WORKER]).not.toHaveProperty("tools");
        expect(config.agent[AGENT_NAMES.REVIEWER]).not.toHaveProperty("tools");
    });

    it("keeps blocked-clarification guidance compatible with question permission", async () => {
        const config = {
            permission: {
                question: "allow",
            },
        };

        await createConfigHandler()(config);

        expect(config.agent[AGENT_NAMES.COMMANDER].prompt).toContain("question permission allows it");
        expect(config.agent[AGENT_NAMES.COMMANDER].prompt).not.toContain("without asking questions");
    });

    it("leaves Claude rule fallback to OpenCode instead of embedding compatibility prompts", async () => {
        const config = {};

        await createConfigHandler()(config);

        expect(config.agent[AGENT_NAMES.COMMANDER].prompt).not.toContain("<claude_compatibility>");
        expect(config.agent[AGENT_NAMES.COMMANDER].prompt).not.toContain("<project_rules");
    });

    it("reports legacy top-level concurrency config to the runtime callback", async () => {
        const onConcurrencyConfig = vi.fn();
        const config = {
            agentConcurrency: {
                commander: 1,
                planner: 10,
                worker: 10,
                reviewer: 10,
            },
            modelConcurrency: {
                "anthropic/claude-sonnet-4-5-20250929": 2,
            },
            providerConcurrency: {
                anthropic: 3,
            },
            defaultConcurrency: 4,
        };

        await createConfigHandler({ onConcurrencyConfig })(config);

        expect(onConcurrencyConfig).toHaveBeenCalledWith({
            agentConcurrency: config.agentConcurrency,
            modelConcurrency: config.modelConcurrency,
            providerConcurrency: config.providerConcurrency,
            defaultConcurrency: 4,
        });
    });
});
