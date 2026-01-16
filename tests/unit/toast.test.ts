/**
 * Toast Notification Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Toast from "../../src/core/notification/toast";
import { EventBus } from "../../src/core/bus/index";

describe("Toast", () => {
    beforeEach(() => {
        Toast.clear();
        EventBus.clear();
    });

    describe("show", () => {
        it("should create a toast with correct properties", () => {
            const toast = Toast.show({
                title: "Test Title",
                message: "Test message",
                variant: "info",
            });

            expect(toast.id).toMatch(/^toast_/);
            expect(toast.title).toBe("Test Title");
            expect(toast.message).toBe("Test message");
            expect(toast.variant).toBe("info");
            expect(toast.dismissed).toBe(false);
        });

        it("should use default values", () => {
            const toast = Toast.show({
                title: "Test",
                message: "Message",
            });

            expect(toast.variant).toBe("info");
            expect(toast.duration).toBe(5000);
        });

        it("should notify handlers", () => {
            const handler = vi.fn();
            Toast.onToast(handler);

            Toast.show({ title: "Test", message: "Message" });

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe("dismiss", () => {
        it("should mark toast as dismissed", () => {
            const toast = Toast.show({ title: "Test", message: "Message" });

            Toast.dismiss(toast.id);

            expect(toast.dismissed).toBe(true);
        });
    });

    describe("getActive", () => {
        it("should return non-dismissed toasts", () => {
            Toast.show({ title: "Active 1", message: "M" });
            const dismissed = Toast.show({ title: "Dismissed", message: "M" });
            Toast.show({ title: "Active 2", message: "M" });

            Toast.dismiss(dismissed.id);

            const active = Toast.getActive();
            expect(active.length).toBe(2);
        });
    });

    describe("getHistory", () => {
        it("should return toast history", () => {
            Toast.show({ title: "T1", message: "M" });
            Toast.show({ title: "T2", message: "M" });
            Toast.show({ title: "T3", message: "M" });

            const history = Toast.getHistory();
            expect(history.length).toBe(3);
        });

        it("should respect limit", () => {
            for (let i = 0; i < 10; i++) {
                Toast.show({ title: `Toast ${i}`, message: "M" });
            }

            const history = Toast.getHistory(5);
            expect(history.length).toBe(5);
        });
    });

    describe("presets", () => {
        it("taskStarted should show info toast", () => {
            const toast = Toast.presets.taskStarted("task_123", "builder");

            expect(toast.variant).toBe("info");
            expect(toast.title).toBe("Task Started");
        });

        it("taskCompleted should show success toast", () => {
            const toast = Toast.presets.taskCompleted("task_123", "inspector");

            expect(toast.variant).toBe("success");
        });

        it("taskFailed should show persistent error toast", () => {
            const toast = Toast.presets.taskFailed("task_123", "Network error");

            expect(toast.variant).toBe("error");
            expect(toast.duration).toBe(0);  // Persistent
        });

        it("missionComplete should show success toast", () => {
            const toast = Toast.presets.missionComplete("All done!");

            expect(toast.variant).toBe("success");
            expect(toast.title).toContain("Mission Complete");
        });
    });

    describe("onToast and unsubscribe", () => {
        it("should unsubscribe handler", () => {
            const handler = vi.fn();
            const unsubscribe = Toast.onToast(handler);

            Toast.show({ title: "T1", message: "M" });
            expect(handler).toHaveBeenCalledTimes(1);

            unsubscribe();

            Toast.show({ title: "T2", message: "M" });
            expect(handler).toHaveBeenCalledTimes(1);  // Still 1
        });
    });
});
