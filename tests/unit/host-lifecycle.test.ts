import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Plugin } from "@opencode/plugin";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChildSessions } from "../../src/core/session/child-sessions.js";
import { setupPlugin } from "../../src/host/plugin.js";
import { shutdownPendingInjections } from "../../src/core/session/pending-injection.js";
import { configureMissionRuntimeOptions } from "../../src/core/loop/mission-runtime-options.js";

// Process-wide services are released only when the last live instance goes away.
// shutdownPendingInjections is one of them and stands in for the whole set.
vi.mock("../../src/core/session/pending-injection.js", async importOriginal => {
    const actual = await importOriginal<typeof import("../../src/core/session/pending-injection.js")>();
    return { ...actual, shutdownPendingInjections: vi.fn(actual.shutdownPendingInjections) };
});
vi.mock("../../src/core/loop/mission-runtime-options.js", async importOriginal => {
    const actual = await importOriginal<typeof import("../../src/core/loop/mission-runtime-options.js")>();
    return { ...actual, configureMissionRuntimeOptions: vi.fn(actual.configureMissionRuntimeOptions) };
});

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
        event: { subscribe: (_input?: { signal?: AbortSignal }) => emptyEvents() as AsyncIterable<unknown> },
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
        vi.mocked(shutdownPendingInjections).mockClear();
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
        // The per-instance shutdown manager clears the instance's child-session map.
        return { ...createHost(directory, register), disposals, stop: vi.spyOn(ChildSessions.prototype, "clear") };
    }

    it("releases registered hooks and runtime when agent registration fails", async () => {
        const { context, host, disposals, stop } = fixture();
        host.agent.transform.mockRejectedValueOnce(new Error("agent registration failed"));

        await expect(setupPlugin(context)).rejects.toThrow("agent registration failed");

        expect(disposals).toHaveLength(5);
        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
        expect(shutdownPendingInjections).toHaveBeenCalledOnce();
    });

    it("registers nothing and leaks no instance count when runtime setup throws", async () => {
        const failing = fixture();
        vi.mocked(configureMissionRuntimeOptions).mockImplementationOnce(() => {
            throw new Error("runtime setup failed");
        });

        await expect(setupPlugin(failing.context)).rejects.toThrow("runtime setup failed");

        // Nothing was registered with the host before the runtime failed.
        expect(failing.disposals).toHaveLength(0);
        expect(failing.host.agent.transform).not.toHaveBeenCalled();

        // The failed instance never counted as live, so the next instance is the last one.
        const next = fixture();
        const dispose = await setupPlugin(next.context);
        await dispose();
        expect(shutdownPendingInjections).toHaveBeenCalledOnce();
    });

    it("waits for all hook registrations and releases successful ones after a hook failure", async () => {
        const { context, host, disposals, stop } = fixture();
        host.session.hook.mockImplementation((name: string) => {
            if (name === "context") return Promise.reject(new Error("context hook failed"));
            const dispose = vi.fn().mockResolvedValue(undefined);
            disposals.push(dispose);
            return Promise.resolve({ dispose });
        });

        await expect(setupPlugin(context)).rejects.toThrow("context hook failed");

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

        await expect(setupPlugin(context)).rejects.toThrow("synchronous hook failure");

        expect(disposals).toHaveLength(4);
        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
    });

    it("shuts down runtime after a registration disposer fails", async () => {
        const { context, disposals, stop } = fixture();
        const cleanup = await setupPlugin(context);
        disposals[0].mockRejectedValueOnce(new Error("dispose failed"));

        await expect(cleanup()).rejects.toThrow("dispose failed");

        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
    });

    it("shuts down runtime when a registration disposer throws synchronously", async () => {
        const { context, disposals, stop } = fixture();
        const cleanup = await setupPlugin(context);
        disposals[0].mockImplementationOnce(() => { throw new Error("synchronous dispose failure"); });

        await expect(cleanup()).rejects.toThrow("synchronous dispose failure");

        for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
        expect(stop).toHaveBeenCalledOnce();
    });

    // OpenCode serves several directories from one process with one plugin
    // instance each, and disposes an instance when its directory goes idle.
    it("keeps a live instance working after another directory's instance is disposed", async () => {
        const idle = fixture();
        const live = fixture();
        const commands: Array<{ name: string; execute: (input: unknown) => Promise<void> }> = [];
        const synthetic = vi.fn().mockResolvedValue(undefined);
        const interrupt = vi.fn().mockResolvedValue({ interrupted: true });
        Object.assign(live.host.session, { synthetic, interrupt });
        live.host.command.transform = vi.fn(async (edit: (editor: { add: (command: typeof commands[number]) => void }) => void) => {
            edit({ add: command => commands.push(command) });
            return { dispose: vi.fn() };
        }) as never;
        // The live instance learns a busy child of "old-root" from its event stream.
        let childTracked = false;
        live.host.event.subscribe = ({ signal }: { signal?: AbortSignal } = {}) => (async function* () {
            yield { type: "session.created", data: { sessionID: "old-child", parentID: "old-root" } };
            yield { type: "session.execution.started", data: { sessionID: "old-child" } };
            childTracked = true;
            await new Promise(resolve => signal?.addEventListener("abort", resolve, { once: true }));
        })();

        const disposeIdle = await setupPlugin(idle.context);
        const disposeLive = await setupPlugin(live.context);
        await vi.waitFor(() => expect(childTracked).toBe(true));
        await disposeIdle();

        expect(idle.stop).toHaveBeenCalledOnce();
        expect(shutdownPendingInjections).not.toHaveBeenCalled();

        const task = commands.find(command => command.name === "task")!;
        await task.execute({ sessionID: "old-root", prompt: { text: "Old mission" } });
        // Replacing the mission stops the old owner's busy child through this instance's state.
        await expect(task.execute({ sessionID: "new-root", prompt: { text: "New mission" } })).resolves.toBeUndefined();
        expect(interrupt).toHaveBeenCalledWith({ sessionID: "old-child", resume: false });
        expect(synthetic).toHaveBeenLastCalledWith(expect.objectContaining({ sessionID: "new-root" }));

        await disposeLive();
        expect(live.stop).toHaveBeenCalledTimes(2);
        expect(live.stop.mock.contexts[0]).not.toBe(live.stop.mock.contexts[1]);
        expect(shutdownPendingInjections).toHaveBeenCalledOnce();
    });
});
