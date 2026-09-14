import { describe, expect, it } from "vitest";
import { createConfigHandler } from "../../src/plugin-handlers/config-handler.js";
import { AGENT_NAMES } from "../../src/shared/index.js";

describe("createConfigHandler", () => {
    it("preserves user command collisions and emits only supported command fields", async () => {
        const plan = { template: "User plan $ARGUMENTS", agent: "plan", subtask: false };
        const config = { command: { plan } };
        await createConfigHandler()(config);
        expect(config.command.plan).toEqual(plan);
        expect(config.command.task).toBeDefined();
        expect(config.command.task).not.toHaveProperty("argumentHint");
    });

    it("preserves native agent modes and the user's default agent", async () => {
        const config = {
            default_agent: "plan",
            agent: {
                build: { mode: "primary", hidden: false, model: "user/build" },
                plan: { mode: "primary", hidden: false, prompt: "User planning prompt" },
            },
        };
        const originalAgents = structuredClone(config.agent);

        await createConfigHandler()(config);

        expect(config.default_agent).toBe("plan");
        expect(config.agent.build).toEqual(originalAgents.build);
        expect(config.agent.plan).toEqual(originalAgents.plan);
    });

    it("leaves default agent selection to OpenCode when unset", async () => {
        const config = {};

        await createConfigHandler()(config);

        expect(config).not.toHaveProperty("default_agent");
        expect(config.agent[AGENT_NAMES.COMMANDER]).toMatchObject({ mode: "primary" });
        expect(config.agent[AGENT_NAMES.COMMANDER].prompt).toBeTruthy();
    });

    it("uses registration defaults only for absent agent configuration", async () => {
        const commander = {
            mode: "all",
            hidden: true,
            model: "user/commander",
            prompt: "User mission instructions",
            description: "My commander",
            color: "#123456",
        };
        const config = { agent: { [AGENT_NAMES.COMMANDER]: { ...commander } } };

        await createConfigHandler()(config);

        expect(config.agent[AGENT_NAMES.COMMANDER]).toEqual(commander);
    });

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

    it("does not treat top-level OpenCode config as orchestrator plugin options", async () => {
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

        await createConfigHandler()(config);

        expect(config.agent[AGENT_NAMES.COMMANDER].mode).toBe("primary");
        expect(config.agentConcurrency).toEqual({
            commander: 1,
            planner: 10,
            worker: 10,
            reviewer: 10,
        });
    });
});
