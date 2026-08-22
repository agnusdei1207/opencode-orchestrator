import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    cleanupSessionRecovery,
    handleSessionError,
    isSessionRecovering,
    markRecoveryComplete,
} from "../../src/core/recovery/session-recovery";
import { detectErrorType, ERROR_TYPE } from "../../src/shared";

vi.mock("../../src/core/agents/logger", () => ({ log: vi.fn() }));

describe("SessionRecovery", () => {
    const touchedSessions: string[] = [];
    let mockClient: {
        session: {
            prompt: ReturnType<typeof vi.fn>;
        };
    };

    beforeEach(() => {
        mockClient = {
            session: {
                prompt: vi.fn().mockResolvedValue({ data: {} }),
            },
        };
    });

    afterEach(() => {
        for (const sessionID of touchedSessions.splice(0)) {
            cleanupSessionRecovery(sessionID);
        }
        vi.clearAllMocks();
    });

    it("detects recovery-supported error types using the shared detector", () => {
        expect(detectErrorType("tool_result_missing")).toBe(ERROR_TYPE.TOOL_RESULT_MISSING);
        expect(detectErrorType("429 Too Many Requests")).toBe(ERROR_TYPE.RATE_LIMIT);
        expect(detectErrorType("thinking_block_order")).toBe(ERROR_TYPE.THINKING_BLOCK_ORDER);
        expect(detectErrorType("random error message")).toBeNull();
    });

    it("injects a compact tool-crash recovery prompt through the OpenCode session API", async () => {
        const sessionID = "session-recovery-tool";
        touchedSessions.push(sessionID);

        const recovered = await handleSessionError(
            mockClient as unknown as Parameters<typeof handleSessionError>[0],
            sessionID,
            new Error("tool_result_missing"),
        );

        expect(recovered).toBe(true);
        expect(mockClient.session.prompt).toHaveBeenCalledWith({
            path: { id: sessionID },
            body: {
                parts: [{
                    type: "text",
                    synthetic: true,
                    text: expect.stringContaining('<recovery type="tool_crash">'),
                }],
            },
        });
        expect(isSessionRecovering(sessionID)).toBe(false);
    });

    it("does not inject a recovery prompt for unknown errors", async () => {
        const sessionID = "session-recovery-unknown";
        touchedSessions.push(sessionID);

        const recovered = await handleSessionError(
            mockClient as unknown as Parameters<typeof handleSessionError>[0],
            sessionID,
            new Error("unmatched failure"),
        );

        expect(recovered).toBe(false);
        expect(mockClient.session.prompt).not.toHaveBeenCalled();
    });

    it("cleans and resets recovery state without throwing", () => {
        const sessionID = "session-recovery-cleanup";
        touchedSessions.push(sessionID);

        expect(() => markRecoveryComplete(sessionID)).not.toThrow();
        expect(() => cleanupSessionRecovery(sessionID)).not.toThrow();
        expect(isSessionRecovering(sessionID)).toBe(false);
    });
});
