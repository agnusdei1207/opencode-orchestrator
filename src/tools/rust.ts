import { getBinaryPath } from "../utils/binary.js";
import { getRustToolPool } from "./rust-pool.js";
import { log } from "../core/agents/logger.js";

/**
 * Call Rust tool with connection pooling
 * Performance: ~5-10ms (10x faster than spawning each time)
 */
export async function callRustTool(name: string, args: Record<string, unknown>): Promise<string> {
    try {
        const pool = getRustToolPool();
        return await pool.call(name, args);
    } catch (err) {
        log(`[RustTool] Pool error: ${err}`);
        throw err;
    }
}
