import { describe, it, expect } from "vitest";
import { WorkStealingDeque, type WorkItem } from "../../src/core/queue/work-stealing-deque.js";

describe("WorkStealingDeque", () => {
    it("operates as LIFO stack for owner push/pop", () => {
        const deque = new WorkStealingDeque<string>(4);
        expect(deque.isEmpty()).toBe(true);
        expect(deque.size()).toBe(0);

        const item1: WorkItem<string> = { task: "item1", priority: 1, enqueuedAt: Date.now() };
        const item2: WorkItem<string> = { task: "item2", priority: 1, enqueuedAt: Date.now() };

        deque.push(item1);
        deque.push(item2);

        expect(deque.isEmpty()).toBe(false);
        expect(deque.size()).toBe(2);

        // Pop is LIFO (item2 then item1)
        const popped1 = deque.pop();
        expect(popped1?.task).toBe("item2");

        const popped2 = deque.pop();
        expect(popped2?.task).toBe("item1");

        expect(deque.pop()).toBeNull();
        expect(deque.isEmpty()).toBe(true);
    });

    it("operates as FIFO queue for thieves via steal()", () => {
        const deque = new WorkStealingDeque<string>(4);

        const item1: WorkItem<string> = { task: "item1", priority: 1, enqueuedAt: Date.now() };
        const item2: WorkItem<string> = { task: "item2", priority: 1, enqueuedAt: Date.now() };
        const item3: WorkItem<string> = { task: "item3", priority: 1, enqueuedAt: Date.now() };

        deque.push(item1);
        deque.push(item2);
        deque.push(item3);

        // Steal is FIFO (item1, then item2, then item3)
        const stolen1 = deque.steal();
        expect(stolen1?.task).toBe("item1");

        const stolen2 = deque.steal();
        expect(stolen2?.task).toBe("item2");

        const popped = deque.pop();
        expect(popped?.task).toBe("item3");

        expect(deque.steal()).toBeNull();
    });

    it("automatically grows capacity when pushed beyond initial capacity", () => {
        const deque = new WorkStealingDeque<number>(4);

        for (let i = 0; i < 20; i++) {
            deque.push({ task: i, priority: 1, enqueuedAt: Date.now() });
        }

        expect(deque.size()).toBe(20);

        // Pop all and ensure integrity
        for (let i = 19; i >= 0; i--) {
            const item = deque.pop();
            expect(item?.task).toBe(i);
        }

        expect(deque.pop()).toBeNull();
    });

    it("returns null when pop or steal on empty deque", () => {
        const deque = new WorkStealingDeque<string>(4);
        expect(deque.pop()).toBeNull();
        expect(deque.steal()).toBeNull();
    });
});
