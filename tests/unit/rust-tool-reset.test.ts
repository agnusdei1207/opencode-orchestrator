import { beforeEach, describe, expect, it, vi } from "vitest";

type PoolCall = (name: string, args: Record<string, unknown>) => Promise<string>;

interface MockPool {
    call: ReturnType<typeof vi.fn<PoolCall>>;
}

const mocks = vi.hoisted(() => ({
    getRustToolPool: vi.fn<() => MockPool>(),
    log: vi.fn<(message: string) => void>(),
    resetRustToolPool: vi.fn<(reason?: string, expectedPool?: MockPool) => Promise<void>>(),
}));

vi.mock("../../src/tools/rust-pool.js", () => ({
    getRustToolPool: mocks.getRustToolPool,
    resetRustToolPool: mocks.resetRustToolPool,
}));

vi.mock("../../src/core/agents/logger.js", () => ({
    log: mocks.log,
}));

const { callRustTool } = await import("../../src/tools/rust.js");

function createPool(result: Error | string): MockPool {
    const call = vi.fn<PoolCall>();
    if (result instanceof Error) {
        call.mockRejectedValue(result);
    } else {
        call.mockResolvedValue(result);
    }

    return { call };
}

describe("callRustTool pool reset recovery", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.resetRustToolPool.mockResolvedValue(undefined);
    });

    it("resets the first timed-out pool and retries with a fresh pool", async () => {
        const timedOutPool = createPool(new Error("Request timeout"));
        const freshPool = createPool("retry result");
        const args = { file: "src/index.ts" };
        mocks.getRustToolPool
            .mockReturnValueOnce(timedOutPool)
            .mockReturnValueOnce(freshPool);

        await expect(callRustTool("lsp_diagnostics", args)).resolves.toBe("retry result");

        expect(mocks.getRustToolPool).toHaveBeenCalledTimes(2);
        expect(timedOutPool.call).toHaveBeenCalledWith("lsp_diagnostics", args);
        expect(freshPool.call).toHaveBeenCalledWith("lsp_diagnostics", args);
        expect(mocks.resetRustToolPool).toHaveBeenCalledTimes(1);
        expect(mocks.resetRustToolPool).toHaveBeenCalledWith(
            "transport error while calling lsp_diagnostics",
            timedOutPool
        );
    });

    it("throws the retry error without retrying or resetting indefinitely", async () => {
        const timedOutPool = createPool(new Error("Request timeout"));
        const retryError = new Error("retry transport failed");
        const retryPool = createPool(retryError);
        mocks.getRustToolPool
            .mockReturnValueOnce(timedOutPool)
            .mockReturnValueOnce(retryPool);

        await expect(callRustTool("git_status", {})).rejects.toBe(retryError);

        expect(mocks.getRustToolPool).toHaveBeenCalledTimes(2);
        expect(timedOutPool.call).toHaveBeenCalledTimes(1);
        expect(retryPool.call).toHaveBeenCalledTimes(1);
        expect(mocks.resetRustToolPool).toHaveBeenCalledTimes(1);
        expect(mocks.resetRustToolPool).toHaveBeenCalledWith(
            "transport error while calling git_status",
            timedOutPool
        );
    });
});
