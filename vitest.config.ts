import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        /**
         * Several suites do real work per test — bundling with esbuild, spawning
         * Node child processes, importing the built dist bundle. Unloaded they
         * run in well under a second, but the whole suite executes in parallel
         * worker processes, and under that contention a spawn-heavy test can
         * spike far past Vitest's 5s default. That produced intermittent
         * failures that never reproduced when a file was run on its own.
         *
         * 30s is generous headroom over the slowest observed test (~2s) while
         * still bounding a genuinely hung test, which never terminates at all.
         */
        testTimeout: 30_000,
        hookTimeout: 60_000,
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            include: ["src/**/*.ts"],
            thresholds: {
                lines: 85,
                statements: 85,
                functions: 88,
                branches: 72,
            },
        },
    },
});
