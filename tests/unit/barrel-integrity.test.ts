import { describe, it, expect } from "vitest";

describe("Barrel Modules Integrity", () => {
    it("verifies src/core/notification/toast.ts re-exports", async () => {
        const mod = await import("../../src/core/notification/toast.js");
        expect(typeof mod.show).toBe("function");
        expect(typeof mod.dismiss).toBe("function");
        expect(typeof mod.getHistory).toBe("function");
        expect(typeof mod.clear).toBe("function");
        expect(typeof mod.initToastClient).toBe("function");
        expect(typeof mod.TaskToastManager).toBe("function");
        expect(typeof mod.getTaskToastManager).toBe("function");
        expect(typeof mod.initTaskToastManager).toBe("function");
        expect(typeof mod.presets).toBe("object");
    });

    it("verifies src/core/progress/tracker.ts re-exports", async () => {
        const mod = await import("../../src/core/progress/tracker.js");
        expect(typeof mod.startSession).toBe("function");
        expect(typeof mod.getSessionStart).toBe("function");
        expect(typeof mod.recordSnapshot).toBe("function");
        expect(typeof mod.getLatest).toBe("function");
        expect(typeof mod.getHistory).toBe("function");
        expect(typeof mod.clearSession).toBe("function");
        expect(typeof mod.formatElapsed).toBe("function");
        expect(typeof mod.formatProgressBar).toBe("function");
        expect(typeof mod.formatSnapshot).toBe("function");
        expect(typeof mod.calculateRate).toBe("function");
        expect(typeof mod.estimateRemaining).toBe("function");
    });

    it("verifies other index re-export modules", async () => {
        const commands = await import("../../src/core/commands/index.js");
        expect(typeof commands.backgroundTaskManager).toBe("object");

        const context = await import("../../src/core/context/index.js");
        expect(typeof context.checkContextWindow).toBe("function");

        const orchestrator = await import("../../src/core/orchestrator/index.js");
        expect(typeof orchestrator.state).toBe("object");

        const agents = await import("../../src/core/agents/index.js");
        expect(typeof agents.ParallelAgentManager).toBe("function");

        const pluginHandlers = await import("../../src/plugin-handlers/index.js");
        expect(typeof pluginHandlers.createChatMessageHandler).toBe("function");

        const formatting = await import("../../src/utils/formatting/index.js");
        expect(typeof formatting.formatElapsedTime).toBe("function");

        const parsing = await import("../../src/utils/parsing/index.js");
        expect(typeof parsing.safeJsonParse).toBe("function");

        const sanity = await import("../../src/utils/sanity/index.js");
        expect(typeof sanity.checkOutputSanity).toBe("function");

        const bgCmd = await import("../../src/tools/background-cmd/index.js");
        expect(typeof bgCmd.runBackgroundTool).toBe("object");

        const shared = await import("../../src/shared/index.js");
        expect(typeof shared.TASK_STATUS).toBe("object");
    });

    it("verifies all shared domain barrels", async () => {
        const sharedAgent = await import("../../src/shared/agent/index.js");
        expect(sharedAgent).toBeDefined();

        const sharedAgentTypes = await import("../../src/shared/agent/types.js");
        expect(sharedAgentTypes).toBeDefined();

        const sharedCore = await import("../../src/shared/core/index.js");
        expect(sharedCore).toBeDefined();

        const sharedCorePoolable = await import("../../src/shared/core/poolable.js");
        expect(sharedCorePoolable).toBeDefined();

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

        const sharedNotif = await import("../../src/shared/notification/index.js");
        expect(sharedNotif.TOAST_DURATION).toBeDefined();

        const sharedNotifTypes = await import("../../src/shared/notification/types.js");
        expect(sharedNotifTypes).toBeDefined();

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

        const sharedSession = await import("../../src/shared/session/index.js");
        expect(sharedSession.SESSION_EVENTS).toBeDefined();

        const sharedTask = await import("../../src/shared/task/index.js");
        expect(sharedTask.BACKGROUND_STATUS).toBeDefined();

        const sharedTaskTypes = await import("../../src/shared/task/types.js");
        expect(sharedTaskTypes).toBeDefined();

        const sharedTool = await import("../../src/shared/tool/index.js");
        expect(sharedTool.OUTPUT_LABEL).toBeDefined();

        const sharedToolNames = await import("../../src/shared/tool/tool-names.js");
        expect(sharedToolNames.TOOL_NAMES).toBeDefined();

        const sharedVerif = await import("../../src/shared/verification/index.js");
        expect(sharedVerif.VERIFICATION_SIGNALS).toBeDefined();

        const sharedVerifTypes = await import("../../src/shared/verification/types.js");
        expect(sharedVerifTypes).toBeDefined();

        const sanityConst = await import("../../src/utils/sanity/constants/index.js");
        expect(sanityConst.SEVERITY).toBeDefined();
    });
});
