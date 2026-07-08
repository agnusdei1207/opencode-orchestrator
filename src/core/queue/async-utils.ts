/**
 * Async Utilities - Retry, timeout, debounce
 */

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
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        timeoutId.unref?.();
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

/**
 * Debounce async function
 */
export function debounceAsync<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    delayMs: number
): (...args: TArgs) => Promise<TResult> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let latestArgs: TArgs;
    let pending: Array<{
        resolve: (value: TResult) => void;
        reject: (reason: unknown) => void;
    }> = [];

    return (...args: TArgs): Promise<TResult> => {
        latestArgs = args;
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        const promise = new Promise<TResult>((resolve, reject) => {
            pending.push({ resolve, reject });
        });

        timeoutId = setTimeout(async () => {
            const callbacks = pending;
            pending = [];
            timeoutId = undefined;

            try {
                const result = await fn(...latestArgs);
                for (const callback of callbacks) {
                    callback.resolve(result);
                }
            } catch (error) {
                for (const callback of callbacks) {
                    callback.reject(error);
                }
            }
        }, delayMs);

        return promise;
    };
}
