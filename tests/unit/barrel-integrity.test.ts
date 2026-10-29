import { describe, it, expect } from "vitest";

describe("Barrel Modules Integrity", () => {
    it("verifies other index re-export modules", async () => {
        const context = await import("../../src/core/context/index.js");
        expect(typeof context.checkContextWindow).toBe("function");

        const formatting = await import("../../src/utils/formatting/index.js");
        expect(typeof formatting.formatElapsedTime).toBe("function");

        const parsing = await import("../../src/utils/parsing/index.js");
        expect(typeof parsing.detectSlashCommand).toBe("function");

        const sanity = await import("../../src/utils/sanity/index.js");
        expect(typeof sanity.checkOutputSanity).toBe("function");

        const shared = await import("../../src/shared/index.js");
        expect(shared.TOOL_NAMES).toEqual({ UPDATE_TODO: "update_todo", SHELL: "shell" });
        expect(typeof shared.RECOVERY).toBe("object");
    });

    it("does not re-export removed delegation/task constants from the shared barrel", async () => {
        const shared = (await import("../../src/shared/index.js")) as Record<string, unknown>;
        for (const removed of [
            "TASK_STATUS",
            "PARALLEL_TASK",
            "BACKGROUND_TASK",
            "PARALLEL_PARAMS",
            "MEMORY_LIMITS",
            "MEMORY_CONSTANTS",
            "CLI_NAME",
            "ID_PREFIX",
            "STATUS_LABEL",
            "LOOP_LABELS",
        ]) {
            expect(shared[removed], removed).toBeUndefined();
        }
    });

    it("verifies all shared domain barrels", async () => {
        const sharedAgent = await import("../../src/shared/agent/index.js");
        expect(sharedAgent.AGENT_NAMES).toBeDefined();

        const sharedAgentTypes = await import("../../src/shared/agent/types.js");
        expect(sharedAgentTypes).toBeDefined();

        const sharedCore = await import("../../src/shared/core/index.js");
        expect(sharedCore).toBeDefined();

        const sharedErrors = await import("../../src/shared/errors/index.js");
        expect(typeof sharedErrors.detectErrorType).toBe("function");

        const sharedLifecycle = await import("../../src/shared/lifecycle/index.js");
        expect(sharedLifecycle.ShutdownManager).toBeDefined();

        const sharedReg = await import("../../src/shared/lifecycle/registration.js");
        expect(sharedReg).toBeDefined();

        const sharedLoop = await import("../../src/shared/loop/index.js");
        expect(sharedLoop.LOOP).toBeDefined();

        const sharedLoopTypes = await import("../../src/shared/loop/types.js");
        expect(sharedLoopTypes).toBeDefined();

        const sharedMessage = await import("../../src/shared/message/index.js");
        expect(sharedMessage.PART_TYPES).toBeDefined();

        const sharedOsNotif = await import("../../src/shared/notification/os-notify/index.js");
        expect(sharedOsNotif.NOTIFICATION_COMMAND_KEYS).toBeDefined();

        const sharedOsNotifTypes = await import("../../src/shared/notification/os-notify/types.js");
        expect(sharedOsNotifTypes).toBeDefined();

        const sharedOs = await import("../../src/shared/os/index.js");
        expect(sharedOs.PLATFORM).toBeDefined();

        const sharedOsTypes = await import("../../src/shared/os/types.js");
        expect(sharedOsTypes).toBeDefined();

        const sharedPrompt = await import("../../src/shared/prompt/index.js");
        expect(sharedPrompt.PHILOSOPHY_TAGLINE).toBeDefined();

        const sharedRecovery = await import("../../src/shared/recovery/index.js");
        expect(sharedRecovery.RECOVERY).toBeDefined();
        expect(typeof sharedRecovery.RECOVERY.RETRY_COOLDOWN_MS).toBe("number");

        const sharedSession = await import("../../src/shared/session/index.js");
        expect(sharedSession.SESSION_EVENTS).toBeDefined();

        const sharedTool = await import("../../src/shared/tool/index.js");
        expect(sharedTool.OUTPUT_LABEL).toBeDefined();

        const sharedToolNames = await import("../../src/shared/tool/tool-names.js");
        expect(sharedToolNames.TOOL_NAMES).toBeDefined();

        const sharedLogger = await import("../../src/shared/logger.js");
        expect(typeof sharedLogger.log).toBe("function");

        const sharedVerif = await import("../../src/shared/verification/index.js");
        expect(sharedVerif.CHECKLIST_CATEGORIES).toBeDefined();

        const sharedVerifTypes = await import("../../src/shared/verification/types.js");
        expect(sharedVerifTypes).toBeDefined();

        const sanityConst = await import("../../src/utils/sanity/constants/index.js");
        expect(sanityConst.SEVERITY).toBeDefined();
    });
});
