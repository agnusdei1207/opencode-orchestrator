/**
 * Chase-Lev Work-Stealing Deque
 *
 * Lock-free deque for efficient work-stealing scheduling.
 * - Owner pushes/pops from bottom (LIFO for cache locality)
 * - Thieves steal from top (FIFO for fairness)
 *
 * Based on: "Dynamic Circular Work-Stealing Deque" (Chase & Lev, 2005)
 */

import { TaskPriority } from "../agents/concurrency.js";

export interface WorkItem<T> {
    task: T;
    priority: TaskPriority;
    enqueuedAt: number;
}

/**
 * Circular array that automatically grows
 */
class CircularArray<T> {
    private items: (T | null)[];
    private capacity: number;

    constructor(initialCapacity: number = 32) {
        this.capacity = initialCapacity;
        this.items = new Array(initialCapacity).fill(null);
    }

    get(index: number): T | null {
        return this.items[index % this.capacity];
    }

    put(index: number, item: T): void {
        this.items[index % this.capacity] = item;
    }

    grow(bottom: number, top: number): CircularArray<T> {
        const newCapacity = this.capacity * 2;
        const newArray = new CircularArray<T>(newCapacity);

        for (let i = top; i < bottom; i++) {
            newArray.put(i, this.get(i)!);
        }

        return newArray;
    }

    getCapacity(): number {
        return this.capacity;
    }
}

/**
 * Work-Stealing Deque (Chase-Lev)
 */
export class WorkStealingDeque<T> {
    private top: number = 0;
    private bottom: number = 0;
    private array: CircularArray<WorkItem<T>>;

    constructor(initialCapacity: number = 32) {
        this.array = new CircularArray(initialCapacity);
    }

    /**
     * Push item to bottom (owner only)
     * LIFO for owner = better cache locality
     */
    push(item: WorkItem<T>): void {
        const b = this.bottom;
        const t = this.top;
        let a = this.array;

        const size = b - t;
        if (size >= a.getCapacity() - 1) {
            a = a.grow(b, t);
            this.array = a;
        }

        a.put(b, item);
        this.bottom = b + 1;
    }

    /**
     * Pop item from bottom (owner only)
     * LIFO for owner = better cache locality
     */
    pop(): WorkItem<T> | null {
        const b = this.bottom - 1;
        this.bottom = b;

        const t = this.top;
        const size = b - t;

        if (size < 0) {
            this.bottom = t;
            return null;
        }

        const a = this.array;
        const item = a.get(b);

        if (size === 0) {
            // Last item - race with steal
            const oldTop = t;
            this.top = t + 1;

            if (oldTop !== this.top - 1) {
                // Lost race to thief
                this.bottom = t + 1;
                return null;
            }

            this.bottom = t + 1;
            return item;
        }

        return item;
    }

    /**
     * Steal item from top (thieves)
     * FIFO for thieves = better fairness
     */
    steal(): WorkItem<T> | null {
        const t = this.top;
        const b = this.bottom;
        const size = b - t;

        if (size <= 0) {
            return null;
        }

        const a = this.array;
        const item = a.get(t);

        // Try to increment top
        const oldTop = t;
        this.top = t + 1;

        if (oldTop !== this.top - 1) {
            // Lost race
            return null;
        }

        return item;
    }

    /**
     * Get current size (approximate, not thread-safe)
     */
    size(): number {
        const b = this.bottom;
        const t = this.top;
        return Math.max(0, b - t);
    }

    /**
     * Check if empty
     */
    isEmpty(): boolean {
        return this.size() === 0;
    }
}
