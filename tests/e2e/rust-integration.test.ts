/**
 * Runs the built `orchestrator` CLI binary.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { getBinaryPath } from "../../src/utils/binary.js";

const CLI_TIMEOUT_MS = 5000;

// Resolve the binary exactly as the plugin runtime does. The suite is
// reported as skipped when the binary has not been built.
const resolvedBinaryPath = getBinaryPath();
const binaryPath = existsSync(resolvedBinaryPath) ? resolvedBinaryPath : null;

describe.skipIf(!binaryPath)("Rust CLI execution", () => {
    it("should execute --help", () => {
        const result = spawnSync(binaryPath!, ["--help"], { encoding: "utf-8", timeout: CLI_TIMEOUT_MS });

        expect(result.status).toBe(0);
        // Help is printed to stderr.
        expect(result.stderr.toLowerCase()).toContain("orchestrator");
    });

    it("should execute --version", () => {
        const result = spawnSync(binaryPath!, ["--version"], { encoding: "utf-8", timeout: CLI_TIMEOUT_MS });

        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });
});
