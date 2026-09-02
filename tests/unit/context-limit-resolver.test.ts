/**
 * Context limit resolution (issue #40)
 *
 * The context-window monitor used to measure every model against a hardcoded
 * 200k window. The resolver replaces that with: explicit override → model
 * metadata reported by the host → legacy default.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContextLimitResolver } from "../../src/core/context/context-limit-resolver";
import { CONTEXT_MONITOR_CONFIG } from "../../src/core/context/context-window-monitor";
import { parseOrchestratorPluginOptions } from "../../src/core/config/plugin-options";
import { createChatParamsHandler } from "../../src/plugin-handlers/chat-params-handler";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

const DEFAULT_LIMIT = CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;

/** Mirrors `GET /provider`: providers come back as an array under `all`. */
function createClient(models: Record<string, { limit?: { context?: number } }>, shouldFail = false) {
    return {
        provider: {
            list: vi.fn().mockImplementation(() =>
                shouldFail
                    ? Promise.reject(new Error("server unavailable"))
                    : Promise.resolve({ data: { all: [{ id: "zai", models }], default: {}, connected: [] } }),
            ),
        },
    };
}

describe("ContextLimitResolver", () => {
    let resolver: ContextLimitResolver;

    beforeEach(() => {
        resolver = ContextLimitResolver.getInstance();
        resolver.reset();
    });

    it("returns the explicit override regardless of model metadata", async () => {
        resolver.configure({ client: createClient({ "glm-5.3": { limit: { context: 1_000_000 } } }) as never, overrideMaxTokens: 500_000 });
        resolver.rememberModel("ses", "zai", "glm-5.3", 1_000_000);

        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(500_000);
        expect(resolver.resolveForSession("ses")).toBe(500_000);
    });

    it("uses the limit a hook reported without touching the server", async () => {
        const client = createClient({});
        resolver.configure({ client: client as never });
        resolver.rememberModel("ses", "zai", "glm-5.3", 1_000_000);

        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
        expect(resolver.resolveForSession("ses")).toBe(1_000_000);
        expect(client.provider.list).not.toHaveBeenCalled();
    });

    it("reads the limit from the provider listing when no hook has reported it", async () => {
        resolver.configure({ client: createClient({ "glm-5.3": { limit: { context: 1_000_000 } } }) as never });
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
    });

    it("falls back to the default when metadata is missing, malformed, or the lookup fails", async () => {
        resolver.configure({ client: createClient({ "glm-5.3": {} }) as never });
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(DEFAULT_LIMIT);

        resolver.reset();
        resolver.configure({ client: createClient({ "glm-5.3": { limit: { context: 0 } } }) as never });
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(DEFAULT_LIMIT);

        resolver.reset();
        resolver.configure({ client: createClient({}, true) as never });
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(DEFAULT_LIMIT);
    });

    it("falls back to the default without a client, model ids, or a known session", async () => {
        await expect(resolver.resolve()).resolves.toBe(DEFAULT_LIMIT);
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(DEFAULT_LIMIT);
        expect(resolver.resolveForSession("unknown")).toBe(DEFAULT_LIMIT);
    });

    it("fetches the provider listing once and shares it across models and callers", async () => {
        const client = createClient({
            "glm-5.3": { limit: { context: 1_000_000 } },
            "glm-5.3-flash": { limit: { context: 200_000 } },
        });
        resolver.configure({ client: client as never });

        const [a, b, c] = await Promise.all([
            resolver.resolve("zai", "glm-5.3"),
            resolver.resolve("zai", "glm-5.3-flash"),
            resolver.resolve("zai", "glm-5.3"),
        ]);
        expect([a, b, c]).toEqual([1_000_000, 200_000, 1_000_000]);
        expect(client.provider.list).toHaveBeenCalledTimes(1);
    });

    it("retries the listing after a failed fetch instead of pinning the default", async () => {
        const list = vi.fn()
            .mockRejectedValueOnce(new Error("boot"))
            .mockResolvedValue({ data: { all: [{ id: "zai", models: { "glm-5.3": { limit: { context: 1_000_000 } } } }] } });
        resolver.configure({ client: { provider: { list } } as never });

        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(DEFAULT_LIMIT);
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
        expect(list).toHaveBeenCalledTimes(2);
    });

    it("ignores an unusable hook limit but still maps the session to its model", async () => {
        resolver.configure({ client: createClient({ "glm-5.3": { limit: { context: 1_000_000 } } }) as never });
        resolver.rememberModel("ses", "zai", "glm-5.3", undefined);

        expect(resolver.resolveForSession("ses")).toBe(DEFAULT_LIMIT);
        await resolver.resolve("zai", "glm-5.3");
        expect(resolver.resolveForSession("ses")).toBe(1_000_000);

        resolver.forgetSession("ses");
        expect(resolver.resolveForSession("ses")).toBe(DEFAULT_LIMIT);
    });
});

describe("chat.params handler", () => {
    beforeEach(() => {
        ContextLimitResolver.getInstance().reset();
    });

    it("remembers the model window the host resolved for the session", async () => {
        const handler = createChatParamsHandler();

        await handler(
            {
                sessionID: "ses-1",
                agent: "commander",
                model: { id: "glm-5.3", providerID: "zai", limit: { context: 1_000_000, output: 65_536 } },
            } as never,
            {} as never,
        );

        const resolver = ContextLimitResolver.getInstance();
        expect(resolver.resolveForSession("ses-1")).toBe(1_000_000);
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
    });

    it("tolerates a hook call without a model", async () => {
        await expect(createChatParamsHandler()({ sessionID: "ses-1" } as never, {} as never)).resolves.toBeUndefined();
    });
});

describe("parseOrchestratorPluginOptions contextMaxTokens", () => {
    it("accepts a positive integer override", () => {
        expect(parseOrchestratorPluginOptions({ contextMaxTokens: 1_000_000 }).contextMaxTokens).toBe(1_000_000);
    });

    it("omits the override for missing or invalid values", () => {
        expect(parseOrchestratorPluginOptions({}).contextMaxTokens).toBeUndefined();
        expect(parseOrchestratorPluginOptions({ contextMaxTokens: -5 }).contextMaxTokens).toBeUndefined();
        expect(parseOrchestratorPluginOptions({ contextMaxTokens: 2.5 }).contextMaxTokens).toBeUndefined();
        expect(parseOrchestratorPluginOptions({ contextMaxTokens: "big" }).contextMaxTokens).toBeUndefined();
    });
});
