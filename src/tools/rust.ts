import { getRustToolPool } from "./rust-pool.js";

export async function callRustTool(name: string, args: Record<string, unknown>): Promise<string> {
    // A lost response does not prove a mutation failed; never replay it implicitly.
    return getRustToolPool().call(name, args);
}
