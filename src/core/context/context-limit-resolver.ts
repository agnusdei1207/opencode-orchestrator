/**
 * Context Limit Resolver
 *
 * Decides how large the context window is for a given model (issue #40).
 * Before this, every model was measured against a hardcoded 200k window, so a
 * 1M-token model got "near limit" warnings while barely 20% used.
 *
 * Resolution order:
 * 1. `contextMaxTokens` plugin option — an explicit user override for all models.
 * 2. Model metadata the host already told us: `chat.params` runs before every
 *    LLM call with `model.limit.context`, and `provider.list()` returns the
 *    same limit for every configured model. Hook data is remembered as it
 *    arrives; the server lookup is the fallback for a session we have not seen
 *    a `chat.params` call for.
 * 3. `CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS` — the legacy default.
 *
 * Server metadata is fetched once per process with a single in-flight
 * request. A failed fetch is not cached, so a temporarily unavailable server
 * does not pin the default for the rest of the session.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { CONTEXT_MONITOR_CONFIG } from "./context-window-monitor.js";
import { log } from "../agents/logger.js";
import { withTimeout } from "../queue/async-utils.js";

type OpencodeClient = PluginInput["client"];

/** Bound on the one-time provider-metadata fetch so a hung server cannot stall callers. */
const LISTING_TIMEOUT_MS = 5_000;

export interface ContextLimitResolverConfig {
    /** OpenCode client used for the `provider.list()` fallback. */
    client?: OpencodeClient;
    /** Explicit limit for every model, from the `contextMaxTokens` option. */
    overrideMaxTokens?: number;
}

/** The subset of `GET /provider` this resolver reads. */
interface ProviderListing {
    all?: Array<{
        id?: string;
        models?: Record<string, { limit?: { context?: number } }>;
    }>;
}

function modelKey(providerID: string, modelID: string): string {
    return `${providerID}/${modelID}`;
}

function isUsableLimit(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export class ContextLimitResolver {
    private static instance: ContextLimitResolver;

    private client?: OpencodeClient;
    private overrideMaxTokens?: number;
    /** `provider/model` → context limit, from hooks or the server listing. */
    private readonly limitsByModel = new Map<string, number>();
    /** Session → `provider/model` it last prompted with. */
    private readonly modelBySession = new Map<string, string>();
    private listingPromise: Promise<ProviderListing> | null = null;

    static getInstance(): ContextLimitResolver {
        if (!ContextLimitResolver.instance) {
            ContextLimitResolver.instance = new ContextLimitResolver();
        }
        return ContextLimitResolver.instance;
    }

    configure(config: ContextLimitResolverConfig): void {
        this.client = config.client;
        this.overrideMaxTokens = isUsableLimit(config.overrideMaxTokens) ? config.overrideMaxTokens : undefined;
    }

    /**
     * Record what the host told a hook about the model a session is using.
     * `chat.params` fires before every LLM call, so by the time the resulting
     * `message.updated` arrives the limit is already known without a request.
     */
    rememberModel(sessionID: string | undefined, providerID: string, modelID: string, contextLimit: unknown): void {
        if (!providerID || !modelID) return;

        const key = modelKey(providerID, modelID);
        if (isUsableLimit(contextLimit)) {
            this.limitsByModel.set(key, contextLimit);
        }
        if (sessionID) {
            this.modelBySession.set(sessionID, key);
        }
    }

    /** Resolve the window for a model, consulting the server listing if needed. */
    async resolve(providerID?: string, modelID?: string): Promise<number> {
        if (this.overrideMaxTokens !== undefined) return this.overrideMaxTokens;
        if (!providerID || !modelID) return CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;

        const key = modelKey(providerID, modelID);
        const known = this.limitsByModel.get(key);
        if (known !== undefined) return known;

        const listed = await this.lookupListedLimit(providerID, modelID);
        if (listed !== undefined) {
            this.limitsByModel.set(key, listed);
            return listed;
        }
        return CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;
    }

    /**
     * Resolve the window for a session from what its hooks reported. Used by
     * call sites that have no model IDs of their own and must not block.
     */
    resolveForSession(sessionID: string): number {
        if (this.overrideMaxTokens !== undefined) return this.overrideMaxTokens;

        const key = this.modelBySession.get(sessionID);
        const known = key === undefined ? undefined : this.limitsByModel.get(key);
        return known ?? CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;
    }

    forgetSession(sessionID: string): void {
        this.modelBySession.delete(sessionID);
    }

    /** Test seam: drop every cached and configured value. */
    reset(): void {
        this.client = undefined;
        this.overrideMaxTokens = undefined;
        this.limitsByModel.clear();
        this.modelBySession.clear();
        this.listingPromise = null;
    }

    private async lookupListedLimit(providerID: string, modelID: string): Promise<number | undefined> {
        if (!this.client) return undefined;

        try {
            const listing = await this.fetchListing();
            const provider = listing.all?.find((entry) => entry.id === providerID);
            const limit = provider?.models?.[modelID]?.limit?.context;
            return isUsableLimit(limit) ? limit : undefined;
        } catch (error) {
            log(`[context-limit-resolver] Provider listing lookup failed for ${modelKey(providerID, modelID)}`, error);
            return undefined;
        }
    }

    private fetchListing(): Promise<ProviderListing> {
        if (this.listingPromise) return this.listingPromise;

        const request = withTimeout(
            Promise.resolve(this.client!.provider.list()),
            LISTING_TIMEOUT_MS,
            "Provider listing timed out",
        )
            .then((result) => {
                const data = (result as { data?: unknown }).data;
                if (!data || typeof data !== "object") {
                    throw new Error("Provider listing returned no data");
                }
                return data as ProviderListing;
            })
            .catch((error: unknown) => {
                this.listingPromise = null;
                throw error;
            });

        this.listingPromise = request;
        return request;
    }
}
