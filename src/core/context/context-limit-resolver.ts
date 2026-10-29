/**
 * Context Limit Resolver
 *
 * Decides how large the context window is for a given model (issue #40), so a
 * 1M-token model is not warned about as if it had the legacy 200k window.
 *
 * Resolution order:
 * 1. `contextMaxTokens` plugin option, an explicit override for all models.
 * 2. The limit the host configures for the model (HostClient.modelContextLimit),
 *    cached per model. A failed lookup is not cached.
 * 3. `CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS`, the legacy default.
 */

import { CONTEXT_MONITOR_CONFIG } from "./context-window-monitor.js";
import { log } from "../../shared/logger.js";
import { withTimeout } from "../async/with-timeout.js";

/** Bound on one model-metadata lookup so a hung host cannot stall callers. */
const LOOKUP_TIMEOUT_MS = 5_000;

type ModelLimitLookup = (providerID: string, modelID: string) => Promise<number | undefined>;

interface ContextLimitResolverOptions {
    lookup?: ModelLimitLookup;
    /** Explicit limit for every model, from the `contextMaxTokens` option. */
    overrideMaxTokens?: number;
}

function modelKey(providerID: string, modelID: string): string {
    return `${providerID}/${modelID}`;
}

function isUsableLimit(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export class ContextLimitResolver {
    private readonly lookup?: ModelLimitLookup;
    private readonly overrideMaxTokens?: number;
    /** `provider/model` → context limit. */
    private readonly limitsByModel = new Map<string, number>();
    /** Session → the model it last prompted with. */
    private readonly modelBySession = new Map<string, { providerID: string; modelID: string }>();

    constructor(options: ContextLimitResolverOptions = {}) {
        this.lookup = options.lookup;
        this.overrideMaxTokens = isUsableLimit(options.overrideMaxTokens) ? options.overrideMaxTokens : undefined;
    }

    /** Record the model a session prompts with, and its limit when the caller knows it. */
    rememberModel(sessionID: string | undefined, providerID: string, modelID: string, contextLimit?: unknown): void {
        if (!providerID || !modelID) return;
        const key = modelKey(providerID, modelID);
        if (isUsableLimit(contextLimit)) this.limitsByModel.set(key, contextLimit);
        if (sessionID) this.modelBySession.set(sessionID, { providerID, modelID });
    }

    /** Resolve the window for a model, asking the host when it is not cached. */
    async resolve(providerID?: string, modelID?: string): Promise<number> {
        if (this.overrideMaxTokens !== undefined) return this.overrideMaxTokens;
        if (!providerID || !modelID) return CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;
        const key = modelKey(providerID, modelID);
        const known = this.limitsByModel.get(key);
        if (known !== undefined) return known;
        const looked = await this.lookupLimit(providerID, modelID);
        if (looked === undefined) return CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;
        this.limitsByModel.set(key, looked);
        return looked;
    }

    /**
     * Resolve the window for a session from what is already cached. Used by
     * call sites that have no model IDs of their own and must not block.
     */
    resolveForSession(sessionID: string): number {
        if (this.overrideMaxTokens !== undefined) return this.overrideMaxTokens;
        const model = this.modelBySession.get(sessionID);
        const known = model === undefined ? undefined : this.limitsByModel.get(modelKey(model.providerID, model.modelID));
        return known ?? CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS;
    }

    /**
     * Resolve the window for the model the session last prompted with, asking
     * the host when it is not cached. Host step events carry no model, so this
     * is how usage is measured against the right window.
     */
    async resolveSession(sessionID: string): Promise<number> {
        const model = this.modelBySession.get(sessionID);
        return this.resolve(model?.providerID, model?.modelID);
    }

    forgetSession(sessionID: string): void {
        this.modelBySession.delete(sessionID);
    }

    private async lookupLimit(providerID: string, modelID: string): Promise<number | undefined> {
        if (!this.lookup) return undefined;
        try {
            const limit = await withTimeout(this.lookup(providerID, modelID), LOOKUP_TIMEOUT_MS, "Model limit lookup timed out");
            return isUsableLimit(limit) ? limit : undefined;
        } catch (error) {
            log(`[context-limit-resolver] Model limit lookup failed for ${modelKey(providerID, modelID)}`, error);
            return undefined;
        }
    }
}
