/**
 * Test Fixture Utilities
 *
 * Provides temporary directory management and test isolation patterns
 * inspired by opencode's test/fixture/fixture.ts
 *
 * @module tests/harness/fixture
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * Strip null bytes from paths (defensive fix for CI environment issues)
 */
function sanitizePath(p: string): string {
    return p.replace(/\0/g, "");
}

/**
 * Check if directory exists
 */
function exists(dir: string): boolean {
    try {
        fs.statSync(dir);
        return true;
    } catch {
        return false;
    }
}

/**
 * Clean directory recursively with retry
 */
function clean(dir: string): void {
    try {
        fs.rmSync(dir, {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 100,
        });
    } catch {
        // Ignore cleanup errors
    }
}

/**
 * Options for creating temporary test directories
 */
export interface TmpDirOptions<T = unknown> {
    /** Initialize a git repository */
    git?: boolean;
    /** Create initial opencode.json config */
    config?: Record<string, unknown>;
    /** Custom initialization function */
    init?: (dir: string) => T | Promise<T>;
    /** Custom cleanup function */
    dispose?: (dir: string) => void | Promise<void>;
    /** Prefix for temp directory name */
    prefix?: string;
}

/**
 * Result of tmpdir creation
 */
export interface TmpDirResult<T = unknown> {
    /** Absolute path to temp directory */
    path: string;
    /** Extra data from init function */
    extra: T;
    /** Symbol for async disposable (using pattern) */
    [Symbol.asyncDispose]: () => Promise<void>;
    /** Symbol for sync disposable */
    [Symbol.dispose]: () => void;
}

/**
 * Create a temporary directory for testing with automatic cleanup
 *
 * @example
 * ```ts
 * // Basic usage
 * await using tmp = await tmpdir();
 * console.log(tmp.path); // /var/folders/.../opencode-test-abc123
 * // Auto-cleanup when scope ends
 *
 * // With git init
 * await using tmp = await tmpdir({ git: true });
 *
 * // With config
 * await using tmp = await tmpdir({
 *   config: { plugin: ["my-plugin"] }
 * });
 *
 * // With custom init
 * await using tmp = await tmpdir({
 *   init: async (dir) => {
 *     await fs.promises.writeFile(path.join(dir, 'test.txt'), 'hello');
 *     return { customData: 42 };
 *   }
 * });
 * console.log(tmp.extra.customData); // 42
 * ```
 */
export async function tmpdir<T = unknown>(options?: TmpDirOptions<T>): Promise<TmpDirResult<T>> {
    const prefix = options?.prefix ?? "opencode-orchestrator-test-";
    const dirpath = sanitizePath(
        path.join(os.tmpdir(), prefix + Math.random().toString(36).slice(2))
    );

    await fs.promises.mkdir(dirpath, { recursive: true });

    // Initialize git if requested
    if (options?.git) {
        const { execSync } = await import("child_process");
        execSync("git init", { cwd: dirpath, stdio: "pipe" });
        execSync("git config core.fsmonitor false", { cwd: dirpath, stdio: "pipe" });
        execSync('git config user.email "test@opencode-orchestrator.test"', {
            cwd: dirpath,
            stdio: "pipe",
        });
        execSync('git config user.name "Test"', { cwd: dirpath, stdio: "pipe" });
        execSync(`git commit --allow-empty -m "root commit ${dirpath}"`, {
            cwd: dirpath,
            stdio: "pipe",
        });
    }

    // Create config file if provided
    if (options?.config) {
        await fs.promises.writeFile(
            path.join(dirpath, "opencode.json"),
            JSON.stringify(
                {
                    $schema: "https://opencode.ai/config.json",
                    ...options.config,
                },
                null,
                2
            )
        );
    }

    const realpath = sanitizePath(await fs.promises.realpath(dirpath));

    let extra: T;
    let initFailed = false;

    try {
        extra = (await options?.init?.(realpath)) as T;
    } catch (err) {
        initFailed = true;
        clean(realpath);
        throw err;
    }

    let disposed = false;

    const dispose = async () => {
        if (disposed) return;
        disposed = true;

        try {
            await options?.dispose?.(realpath);
        } finally {
            if (options?.git) {
                try {
                    const { execSync } = await import("child_process");
                    execSync("git fsmonitor--daemon stop", {
                        cwd: realpath,
                        stdio: "pipe",
                    });
                } catch {
                    // Ignore
                }
            }
            clean(realpath);
        }
    };

    return {
        path: realpath,
        extra,
        [Symbol.asyncDispose]: dispose,
        [Symbol.dispose]: () => {
            // Sync version - just schedule cleanup
            process.nextTick(() => dispose().catch(() => {}));
        },
    };
}

/**
 * Synchronous version of tmpdir for simpler test cases
 */
export function tmpdirSync(options?: Omit<TmpDirOptions, "init" | "dispose">): {
    path: string;
    [Symbol.dispose]: () => void;
} {
    const prefix = options?.prefix ?? "opencode-orchestrator-test-";
    const dirpath = sanitizePath(
        path.join(os.tmpdir(), prefix + Math.random().toString(36).slice(2))
    );

    fs.mkdirSync(dirpath, { recursive: true });

    if (options?.git) {
        const { execSync } = require("child_process");
        execSync("git init", { cwd: dirpath, stdio: "pipe" });
        execSync("git config core.fsmonitor false", { cwd: dirpath, stdio: "pipe" });
        execSync('git config user.email "test@opencode-orchestrator.test"', {
            cwd: dirpath,
            stdio: "pipe",
        });
        execSync('git config user.name "Test"', { cwd: dirpath, stdio: "pipe" });
    }

    if (options?.config) {
        fs.writeFileSync(
            path.join(dirpath, "opencode.json"),
            JSON.stringify(
                {
                    $schema: "https://opencode.ai/config.json",
                    ...options.config,
                },
                null,
                2
            )
        );
    }

    const realpath = sanitizePath(fs.realpathSync(dirpath));

    return {
        path: realpath,
        [Symbol.dispose]: () => clean(realpath),
    };
}

/**
 * Create a mock file system structure for testing
 */
export async function createMockFs(
    baseDir: string,
    structure: Record<string, string | Record<string, unknown>>
): Promise<void> {
    for (const [filePath, content] of Object.entries(structure)) {
        const fullPath = path.join(baseDir, filePath);
        const dir = path.dirname(fullPath);

        await fs.promises.mkdir(dir, { recursive: true });

        if (typeof content === "string") {
            await fs.promises.writeFile(fullPath, content);
        } else {
            await fs.promises.writeFile(fullPath, JSON.stringify(content, null, 2));
        }
    }
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
    condition: () => boolean | Promise<boolean>,
    options?: { timeout?: number; interval?: number }
): Promise<void> {
    const timeout = options?.timeout ?? 5000;
    const interval = options?.interval ?? 50;
    const start = Date.now();

    while (Date.now() - start < timeout) {
        if (await condition()) return;
        await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}
