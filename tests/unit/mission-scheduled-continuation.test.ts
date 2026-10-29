import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HostClient } from "../../src/host/client";
import { startMissionLoop } from "../../src/core/loop/mission-loop";
import { handleMissionIdle, cleanupSession } from "../../src/core/loop/mission-loop-handler";
import { resetSessionActivity } from "../../src/core/session/activity";
import { configureMissionRuntimeOptions } from "../../src/core/loop/mission-runtime-options";

const verification = vi.hoisted(() => ({ failNext: false }));
const logger = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("../../src/core/loop/verification", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../src/core/loop/verification")>();
    return {
        ...actual,
        verifyMissionCompletion: vi.fn((directory: string) => {
            if (verification.failNext) throw new Error("verification crashed");
            return actual.verifyMissionCompletion(directory);
        }),
    };
});
vi.mock("../../src/core/agents/logger", () => logger);
vi.mock("../../src/core/notification/os-notify/notifier", () => ({ sendNotification: vi.fn() }));
vi.mock("../../src/core/notification/os-notify/sound-player", () => ({ playSound: vi.fn() }));

describe("scheduled mission continuation", () => {
    const sessionID = "scheduled-owner";
    let directory: string;
    let client: HostClient;

    beforeEach(() => {
        vi.useFakeTimers();
        verification.failNext = false;
        logger.log.mockClear();
        cleanupSession(sessionID);
        resetSessionActivity();
        configureMissionRuntimeOptions({ ledger: false, markdownMemory: false });
        directory = mkdtempSync(join(tmpdir(), "mission-scheduled-"));
        startMissionLoop(directory, sessionID, "Finish the requested scope");
        client = {
            prompt: vi.fn().mockResolvedValue(undefined),
            statuses: vi.fn(() => new Map<string, string>()),
        } as unknown as HostClient;
    });
    afterEach(() => {
        cleanupSession(sessionID);
        resetSessionActivity();
        configureMissionRuntimeOptions({});
        vi.useRealTimers();
        rmSync(directory, { recursive: true, force: true });
    });

    it("contains a failure raised inside the countdown callback", async () => {
        writeFileSync(join(directory, ".opencode/todo.md"), "- [ ] Remaining");
        await handleMissionIdle({ client, directory, tasks: { getTasksByParent: () => [] } }, sessionID);
        verification.failNext = true;

        const unhandled = vi.fn();
        process.on("unhandledRejection", unhandled);
        try {
            await vi.advanceTimersByTimeAsync(3000);
            await vi.runAllTicks();
        } finally {
            process.off("unhandledRejection", unhandled);
        }

        expect(unhandled).not.toHaveBeenCalled();
        expect(client.prompt).not.toHaveBeenCalled();
        expect(logger.log).toHaveBeenCalledWith(
            expect.stringContaining("Scheduled continuation failed"),
            expect.objectContaining({ sessionID }),
        );
    });
});
