import { describe, expect, it } from "vitest";
import { parseOrchestratorPluginOptions } from "../../src/core/config/plugin-options.js";
import { createChatParamsHandler } from "../../src/plugin-handlers/chat-params-handler.js";

describe("agent temperature options", () => {
    it("accepts finite per-agent temperatures and ignores invalid values", () => {
        const options = parseOrchestratorPluginOptions({
            agentTemperatures: { Commander: 0.1, Planner: -1, Worker: "warm" },
        });
        expect(options.agentTemperatures).toEqual({ Commander: 0.1 });
    });

    it("applies a configured temperature to OpenCode 1 model calls", async () => {
        const output = { temperature: 0.7 };
        const handler = createChatParamsHandler({ Commander: 0.1 });
        await handler({ sessionID: "s1", agent: "Commander", model: { providerID: "p", id: "m" } } as never, output as never);
        expect(output.temperature).toBe(0.1);
    });

    it("leaves unconfigured agents at the host temperature", async () => {
        const output = { temperature: 0.7 };
        const handler = createChatParamsHandler({ Commander: 0.1 });
        await handler({ sessionID: "s1", agent: "Worker", model: { providerID: "p", id: "m" } } as never, output as never);
        expect(output.temperature).toBe(0.7);
    });

    it("does not send temperature to a model that declares no support", async () => {
        const output = { temperature: 0.7 };
        const handler = createChatParamsHandler({ Commander: 0.1 });
        await handler({ sessionID: "s1", agent: "Commander", model: {
            providerID: "p", id: "m", capabilities: { temperature: false },
        } } as never, output as never);
        expect(output.temperature).toBe(0.7);
    });
});
