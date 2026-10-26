/**
 * Toast Core Unit Tests
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
    initToastClient,
    show,
} from "../../src/core/notification/toast-core";

type ToastPayload = {
    body: {
        title: string;
        message: string;
        variant: string;
        duration: number;
    };
    signal?: AbortSignal;
};

describe("toast-core", () => {
    let cleanup: (() => void) | undefined;

    afterEach(() => {
        cleanup?.();
        cleanup = undefined;
    });

    it("sends a typed toast payload with an AbortSignal to the TUI client", async () => {
        const showToast = vi.fn((payload: unknown) => Promise.resolve(payload));
        const client = {
            tui: { showToast },
        } as unknown as Parameters<typeof initToastClient>[0];
        cleanup = initToastClient(client);

        const toast = show({
            title: "Build\nTitle",
            message: "Build\u001b[31m feature",
            variant: "warning",
            duration: 2500,
        });
        await Promise.resolve();

        expect(toast.title).toBe("Build Title");
        expect(showToast).toHaveBeenCalledTimes(1);
        const payload = showToast.mock.calls[0][0] as ToastPayload;
        expect(payload.body).toEqual({
            title: "Build Title",
            message: "Build feature",
            variant: "warning",
            duration: 2500,
        });
        expect(payload.signal).toBeInstanceOf(AbortSignal);
    });

    it("cleanup detaches the TUI client", () => {
        const showToast = vi.fn((payload: unknown) => Promise.resolve(payload));
        const client = {
            tui: { showToast },
        } as unknown as Parameters<typeof initToastClient>[0];
        cleanup = initToastClient(client);

        show({ title: "First", message: "Toast" });

        cleanup();
        cleanup = undefined;
        const detached = show({ title: "Second", message: "Toast" });

        expect(showToast).toHaveBeenCalledTimes(1);
        expect(detached.title).toBe("Second");
    });
});
