import { describe, it, expect, vi, beforeEach } from "vitest";
import { log } from "../../src/core/agents/logger.js";
import { NOTIFICATION_COMMAND_KEYS } from "../../src/shared/notification/os-notify/index.js";

vi.mock("../../src/core/agents/logger.js", () => ({ log: vi.fn() }));

describe("platform command resolver", () => {
    beforeEach(() => {
        vi.mocked(log).mockClear();
    });

    it("resolves an available command path", async () => {
        const { resolveCommandPath } = await import("../../src/core/notification/os-notify/platform-resolver");

        const path = await resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.OSASCRIPT,
            "node",
        );

        expect(path).toEqual(expect.any(String));
        expect(path?.length).toBeGreaterThan(0);
        expect(log).not.toHaveBeenCalled();
    });

    it("logs command lookup failures before returning null", async () => {
        const { resolveCommandPath } = await import("../../src/core/notification/os-notify/platform-resolver");
        const commandName = `missing-opencode-command-${Date.now()}`;

        const path = await resolveCommandPath(
            NOTIFICATION_COMMAND_KEYS.AFPLAY,
            commandName,
        );

        expect(path).toBeNull();
        expect(log).toHaveBeenCalledWith(expect.stringContaining(`Command lookup failed for ${commandName}`));
    });
});
