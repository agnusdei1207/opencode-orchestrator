import { getRustToolPool, resetRustToolPool } from "./rust-pool.js";
import { log } from "../core/agents/logger.js";
import { LOG_PREFIX } from "../shared/index.js";

/**
 * Call Rust tool with connection pooling
 * Performance: ~5-10ms (10x faster than spawning each time)
 */
export async function callRustTool(name: string, args: Record<string, unknown>): Promise<string> {
    const pool = getRustToolPool();

    try {
        return await pool.call(name, args);
    } catch (err) {
        log(`[${LOG_PREFIX.RUST_TOOL}] Pool error, resetting and retrying once: ${err}`);
        await resetRustToolPool(`transport error while calling ${name}`, pool);
    }

    const retryPool = getRustToolPool();
    return retryPool.call(name, args);
}
