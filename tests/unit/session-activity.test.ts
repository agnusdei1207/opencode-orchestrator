import { describe, it, expect, beforeEach } from "vitest";
import {
    recordSessionStatus,
    isKnownBusy,
    isSessionBusy,
    clearSessionActivity,
    pruneSessionActivity,
    resetSessionActivity,
} from "../../src/core/session/activity";

/**
 * Minimal HostClient stand-in. `statuses()` mirrors the event-tracked map,
 * which holds only sessions that are NOT idle.
 */
function clientWithStatus(statuses: Record<string, string>, onRead?: () => void) {
    return {
        statuses: () => {
            onRead?.();
            return new Map(Object.entries(statuses));
        },
    } as never;
}

const SESSION = "ses_activity";

describe("session activity tracker (issue #38)", () => {
    beforeEach(() => {
        resetSessionActivity();
    });

    describe("recordSessionStatus", () => {
        it("treats every non-idle status as busy", () => {
            recordSessionStatus(SESSION, "busy");
            expect(isKnownBusy(SESSION)).toBe(true);

            recordSessionStatus(SESSION, "retry");
            expect(isKnownBusy(SESSION)).toBe(true);

            recordSessionStatus(SESSION, "idle");
            expect(isKnownBusy(SESSION)).toBe(false);
        });

        it("ignores empty session ids and missing status types", () => {
            recordSessionStatus("", "busy");
            recordSessionStatus(SESSION, undefined);

            expect(isKnownBusy("")).toBe(false);
            expect(isKnownBusy(SESSION)).toBe(false);
        });

        it("defaults an unseen session to not busy", () => {
            expect(isKnownBusy("never-seen")).toBe(false);
        });
    });

    describe("isSessionBusy", () => {
        it("reports busy when the host lists the session as busy", async () => {
            const client = clientWithStatus({ [SESSION]: "busy" });

            await expect(isSessionBusy(client, SESSION)).resolves.toBe(true);
        });

        it("reports busy while the provider is retrying", async () => {
            const client = clientWithStatus({ [SESSION]: "retry" });

            await expect(isSessionBusy(client, SESSION)).resolves.toBe(true);
        });

        it("reports idle when the session is absent from the status map", async () => {
            // Upstream deletes a session from the map the moment it goes idle,
            // so absence is a positive signal, not missing information.
            const client = clientWithStatus({ other: "busy" });

            await expect(isSessionBusy(client, SESSION)).resolves.toBe(false);
        });

        it("refreshes the cached flag from the host status map", async () => {
            recordSessionStatus(SESSION, "busy");
            const client = clientWithStatus({});

            await expect(isSessionBusy(client, SESSION)).resolves.toBe(false);
            expect(isKnownBusy(SESSION)).toBe(false);
        });

        it("treats an empty session id as idle without reading host status", async () => {
            let called = false;
            const client = clientWithStatus({}, () => { called = true; });

            await expect(isSessionBusy(client, "")).resolves.toBe(false);
            expect(called).toBe(false);
        });
    });

    describe("state lifecycle", () => {
        it("clears a single session", () => {
            recordSessionStatus(SESSION, "busy");
            clearSessionActivity(SESSION);

            expect(isKnownBusy(SESSION)).toBe(false);
        });

        it("prunes states older than the retention window", () => {
            recordSessionStatus(SESSION, "busy");

            pruneSessionActivity(Date.now() + 60 * 60 * 1000);

            expect(isKnownBusy(SESSION)).toBe(false);
        });

        it("keeps recently updated states while pruning", () => {
            recordSessionStatus(SESSION, "busy");

            pruneSessionActivity(Date.now());

            expect(isKnownBusy(SESSION)).toBe(true);
        });
    });
});
