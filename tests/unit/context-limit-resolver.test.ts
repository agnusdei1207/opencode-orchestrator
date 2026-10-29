/**
 * Context limit resolution (issue #40)
 *
 * The context-window monitor used to measure every model against a hardcoded
 * 200k window. The resolver replaces that with: explicit override → model
 * limit reported by the host → legacy default.
 */

import { describe, expect, it, vi } from "vitest";
import { ContextLimitResolver } from "../../src/core/context/context-limit-resolver";
import { CONTEXT_MONITOR_CONFIG } from "../../src/core/context/context-window-monitor";
import { parseOrchestratorOptions } from "../../src/core/config/options";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

const DEFAULT_LIMIT = CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;

/** Mirrors HostClient.modelContextLimit over a fixed model table. */
function createLookup(models: Record<string, number | undefined>, shouldFail = false) {
    return vi.fn(async (providerID: string, modelID: string) => {
        if (shouldFail) throw new Error("server unavailable");
        return models[`${providerID}/${modelID}`];
    });
}

describe("ContextLimitResolver", () => {
    it("returns the explicit override regardless of model metadata", async () => {
        const lookup = createLookup({ "zai/glm-5.3": 1_000_000 });
        const resolver = new ContextLimitResolver({ lookup, overrideMaxTokens: 500_000 });
        resolver.rememberModel("ses", "zai", "glm-5.3", 1_000_000);

        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(500_000);
        expect(resolver.resolveForSession("ses")).toBe(500_000);
        expect(lookup).not.toHaveBeenCalled();
    });

    it("ignores an unusable override", async () => {
        const resolver = new ContextLimitResolver({ lookup: createLookup({ "zai/glm-5.3": 1_000_000 }), overrideMaxTokens: 0 });
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
    });

    it("uses a limit the caller reported without asking the host", async () => {
        const lookup = createLookup({});
        const resolver = new ContextLimitResolver({ lookup });
        resolver.rememberModel("ses", "zai", "glm-5.3", 1_000_000);

        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
        expect(resolver.resolveForSession("ses")).toBe(1_000_000);
        expect(lookup).not.toHaveBeenCalled();
    });

    it("asks the host for the limit when none has been reported", async () => {
        const lookup = createLookup({ "zai/glm-5.3": 1_000_000 });
        const resolver = new ContextLimitResolver({ lookup });

        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
        expect(lookup).toHaveBeenCalledExactlyOnceWith("zai", "glm-5.3");
    });

    it("falls back to the default when the limit is missing, unusable, or the lookup fails", async () => {
        await expect(new ContextLimitResolver({ lookup: createLookup({}) }).resolve("zai", "glm-5.3"))
            .resolves.toBe(DEFAULT_LIMIT);
        await expect(new ContextLimitResolver({ lookup: createLookup({ "zai/glm-5.3": 0 }) }).resolve("zai", "glm-5.3"))
            .resolves.toBe(DEFAULT_LIMIT);
        await expect(new ContextLimitResolver({ lookup: createLookup({}, true) }).resolve("zai", "glm-5.3"))
            .resolves.toBe(DEFAULT_LIMIT);
    });

    it("falls back to the default without a lookup, model ids, or a known session", async () => {
        const resolver = new ContextLimitResolver();
        await expect(resolver.resolve()).resolves.toBe(DEFAULT_LIMIT);
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(DEFAULT_LIMIT);
        expect(resolver.resolveForSession("unknown")).toBe(DEFAULT_LIMIT);
    });

    it("caches a resolved limit per model", async () => {
        const lookup = createLookup({ "zai/glm-5.3": 1_000_000, "zai/glm-5.3-flash": 200_000 });
        const resolver = new ContextLimitResolver({ lookup });

        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
        await expect(resolver.resolve("zai", "glm-5.3-flash")).resolves.toBe(200_000);
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
        expect(lookup).toHaveBeenCalledTimes(2);
    });

    it("retries the lookup after a failure instead of pinning the default", async () => {
        const lookup = vi.fn()
            .mockRejectedValueOnce(new Error("boot"))
            .mockResolvedValue(1_000_000);
        const resolver = new ContextLimitResolver({ lookup });

        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(DEFAULT_LIMIT);
        await expect(resolver.resolve("zai", "glm-5.3")).resolves.toBe(1_000_000);
        expect(lookup).toHaveBeenCalledTimes(2);
    });

    it("gives up on a hung lookup after its timeout", async () => {
        vi.useFakeTimers();
        try {
            const resolver = new ContextLimitResolver({ lookup: () => new Promise<number>(() => {}) });
            const pending = resolver.resolve("zai", "glm-5.3");
            await vi.advanceTimersByTimeAsync(5_000);
            await expect(pending).resolves.toBe(DEFAULT_LIMIT);
        } finally {
            vi.useRealTimers();
        }
    });

    it("ignores an unusable reported limit but still maps the session to its model", async () => {
        const resolver = new ContextLimitResolver({ lookup: createLookup({ "zai/glm-5.3": 1_000_000 }) });
        resolver.rememberModel("ses", "zai", "glm-5.3", undefined);

        expect(resolver.resolveForSession("ses")).toBe(DEFAULT_LIMIT);
        await resolver.resolve("zai", "glm-5.3");
        expect(resolver.resolveForSession("ses")).toBe(1_000_000);

        resolver.forgetSession("ses");
        expect(resolver.resolveForSession("ses")).toBe(DEFAULT_LIMIT);
    });

    it("ignores remembered models without provider or model ids", () => {
        const resolver = new ContextLimitResolver();
        resolver.rememberModel("ses", "", "glm-5.3", 1_000_000);
        expect(resolver.resolveForSession("ses")).toBe(DEFAULT_LIMIT);
    });
});

describe("parseOrchestratorOptions contextMaxTokens", () => {
    it("accepts a positive integer override", () => {
        expect(parseOrchestratorOptions({ contextMaxTokens: 1_000_000 }).contextMaxTokens).toBe(1_000_000);
    });

    it("omits the override for missing or invalid values", () => {
        expect(parseOrchestratorOptions({}).contextMaxTokens).toBeUndefined();
        expect(parseOrchestratorOptions({ contextMaxTokens: -5 }).contextMaxTokens).toBeUndefined();
        expect(parseOrchestratorOptions({ contextMaxTokens: 2.5 }).contextMaxTokens).toBeUndefined();
        expect(parseOrchestratorOptions({ contextMaxTokens: "big" }).contextMaxTokens).toBeUndefined();
    });
});
