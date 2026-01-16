/**
 * Work Pool - Concurrent task execution utilities
 */

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
