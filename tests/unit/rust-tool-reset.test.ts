import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ call: vi.fn(), reset: vi.fn() }));
vi.mock("../../src/tools/rust-pool.js", () => ({
    getRustToolPool: () => ({ call: mocks.call }),
    resetRustToolPool: mocks.reset,
}));
const { callRustTool } = await import("../../src/tools/rust.js");

beforeEach(() => vi.resetAllMocks());
describe("Rust tool transport failures", () => {
    it.each(["sed_replace", "ast_replace", "http", "git_status"])("does not replay an ambiguous %s request", async name => {
        let executions = 0;
        mocks.call.mockImplementation(async () => {
            executions++;
            if (executions === 1) throw new Error("response lost after execution");
            return "executed twice";
        });
        await expect(callRustTool(name, { body: "request" })).rejects.toThrow("response lost after execution");
        expect(executions).toBe(1);
    });

    it("leaves subsequent calls free to use the recovered pool", async () => {
        mocks.call.mockRejectedValueOnce(new Error("transport failed")).mockResolvedValueOnce("fresh result");
        await expect(callRustTool("git_status", {})).rejects.toThrow("transport failed");
        await expect(callRustTool("git_status", {})).resolves.toBe("fresh result");
    });
});
