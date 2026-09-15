/** Resolve a promise or reject when its deadline expires. */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = "Operation timed out",
): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        timeoutId.unref?.();
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
}
