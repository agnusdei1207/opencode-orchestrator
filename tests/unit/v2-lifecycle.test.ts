import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CleanupScheduler } from "../../src/core/cleanup/cleanup-scheduler.js";
import { setupV2 } from "../../src/v2/setup.js";

type Registration = { dispose: ReturnType<typeof vi.fn> };

function createHost(directory: string, register: () => Promise<Registration>) {
    const host = {
        location: { directory, project: { directory } },
        options: {},
        agent: {
            list: vi.fn().mockResolvedValue([]),
            transform: vi.fn(() => register()),
        },
        session: {
            hook: vi.fn((_name: string) => register()),
        },
        tool: {
            hook: vi.fn((_name: string) => register()),
            transform: vi.fn(() => register()),
        },
        command: { transform: vi.fn(() => register()) },
        event: { subscribe: () => emptyEvents() },
    };
    return { context: host as unknown as Plugin.Context, host };
}

async function* emptyEvents(): AsyncGenerator<never> {
    return;
}

describe("OpenCode 2 registration lifecycle", () => {
    const directories: string[] = [];

    afterEach(() => {
        vi.restoreAllMocks();
        for (const directory of directories.splice(0)) {
            rmSync(directory, { recursive: true, force: true });
        }
    });

    function fixture() {
        const directory = mkdtempSync(path.join(tmpdir(), "oco-v2-lifecycle-"));
        directories.push(directory);
        const disposals: Array<ReturnType<typeof vi.fn>> = [];
        const register = () => {
            const dispose = vi.fn().mockResolvedValue(undefined);
            disposals.push(dispose);
            return Promise.resolve({ dispose });
        };
        return { ...createHost(directory, register), disposals, stop: vi.spyOn(CleanupScheduler.prototype, "stop") };
    }

    it("releases registered hooks and runtime when agent registration fails", async () => {
        const { context, host, disposals, stop } = fixture();
        host.agent.transform.mockRejectedValueOnce(new Error("agent registration failed"));

        await expect(setupV2(context)).rejects.toThrow("agent registration failed");

        expect(disposals).toHaveLength(5);
        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
    });

    it("waits for all hook registrations and releases successful ones after a hook failure", async () => {
        const { context, host, disposals, stop } = fixture();
        host.session.hook.mockImplementation((name: string) => {
            if (name === "context") return Promise.reject(new Error("context hook failed"));
            const dispose = vi.fn().mockResolvedValue(undefined);
            disposals.push(dispose);
            return Promise.resolve({ dispose });
        });

        await expect(setupV2(context)).rejects.toThrow("context hook failed");

        expect(disposals).toHaveLength(4);
        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
    });

    it("releases earlier registrations when a hook throws synchronously", async () => {
        const { context, host, disposals, stop } = fixture();
        host.session.hook.mockImplementation((name: string) => {
            if (name === "context") throw new Error("synchronous hook failure");
            const dispose = vi.fn().mockResolvedValue(undefined);
            disposals.push(dispose);
            return Promise.resolve({ dispose });
        });

        await expect(setupV2(context)).rejects.toThrow("synchronous hook failure");

        expect(disposals).toHaveLength(4);
        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
    });

    it("shuts down runtime after a registration disposer fails", async () => {
        const { context, disposals, stop } = fixture();
        const cleanup = await setupV2(context);
        disposals[0].mockRejectedValueOnce(new Error("dispose failed"));

        await expect(cleanup()).rejects.toThrow("dispose failed");

        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
    });

    it("shuts down runtime when a registration disposer throws synchronously", async () => {
        const { context, disposals, stop } = fixture();
        const cleanup = await setupV2(context);
        disposals[0].mockImplementationOnce(() => { throw new Error("synchronous dispose failure"); });

        await expect(cleanup()).rejects.toThrow("synchronous dispose failure");

        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
    });
});
