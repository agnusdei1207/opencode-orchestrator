/**
 * AsyncQueue & Work Pool
 * 
 * Utilities for async iteration and concurrent work processing
 */

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
        // Resolve any pending waiters with undefined
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

/**
 * Work Pool - Concurrent task execution with limit
 * 
 * @param concurrency - Maximum concurrent tasks
 * @param items - Items to process
 * @param fn - Processing function
 */
export async function workPool<T>(
    concurrency: number,
    items: T[],
    fn: (item: T, index: number) => Promise<void>
): Promise<void> {
    const pending = [...items].map((item, index) => ({ item, index }));

    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, async () => {
            while (true) {
                const work = pending.pop();
                if (!work) return;
                await fn(work.item, work.index);
            }
        })
    );
}

/**
 * Work Pool with results - Returns results in order
 */
export async function workPoolWithResults<T, R>(
    concurrency: number,
    items: T[],
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const pending = [...items].map((item, index) => ({ item, index }));

    await Promise.all(
        Array.from({ length: Math.min(concurrency, items.length) }, async () => {
            while (true) {
                const work = pending.pop();
                if (!work) return;
                results[work.index] = await fn(work.item, work.index);
            }
        })
    );

    return results;
}

/**
 * Batch processing - Process items in batches
 */
export async function processBatches<T, R>(
    items: T[],
    batchSize: number,
    fn: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await fn(batch);
        results.push(...batchResults);
    }

    return results;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        backoffFactor?: number;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffFactor = 2,
    } = options;

    let lastError: Error | undefined;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * backoffFactor, maxDelay);
            }
        }
    }

    throw lastError;
}

/**
 * Timeout wrapper
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = "Operation timed out"
): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    return Promise.race([promise, timeout]);
}

/**
 * Debounce async function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    delayMs: number
): T {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let pendingPromise: Promise<any> | undefined;

    return ((...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        return new Promise((resolve, reject) => {
            timeoutId = setTimeout(async () => {
                try {
                    const result = await fn(...args);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            }, delayMs);
        });
    }) as T;
}
