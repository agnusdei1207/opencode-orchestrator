/**
 * AsyncQueue - Async iterable queue
 * 
 * Useful for producer/consumer patterns
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
    private queue: T[] = [];
    private resolvers: ((value: T) => void)[] = [];
    private closed = false;

    /**
     * Push an item to the queue
     */
    push(item: T): void {
        if (this.closed) {
            throw new Error("Queue is closed");
        }

        const resolver = this.resolvers.shift();
        if (resolver) {
            resolver(item);
        } else {
            this.queue.push(item);
        }
    }

    /**
     * Get the next item (blocks if empty)
     */
    async next(): Promise<T> {
        if (this.queue.length > 0) {
            return this.queue.shift()!;
        }

        if (this.closed) {
            throw new Error("Queue is closed");
        }

        return new Promise(resolve => this.resolvers.push(resolve));
    }

    /**
     * Try to get an item without blocking
     */
    tryNext(): T | undefined {
        return this.queue.shift();
    }

    /**
     * Check if queue is empty
     */
    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    /**
     * Get current queue length
     */
    get length(): number {
        return this.queue.length;
    }

    /**
     * Close the queue (no more items can be added)
     */
    close(): void {
        this.closed = true;
        for (const resolver of this.resolvers) {
            resolver(undefined as any);
        }
        this.resolvers = [];
    }

    /**
     * Check if queue is closed
     */
    isClosed(): boolean {
        return this.closed;
    }

    /**
     * Clear all items
     */
    clear(): void {
        this.queue = [];
    }

    /**
     * Async iterator support
     */
    async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
        while (!this.closed || this.queue.length > 0) {
            try {
                yield await this.next();
            } catch {
                break;
            }
        }
    }
}
