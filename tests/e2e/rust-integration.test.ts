/**
 * Rust Integration Tests
 * 
 * Tests for Rust/TypeScript integration:
 * - Binary detection
 * - CLI execution (if binary exists)
 * - File structure verification
 */

import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { getBinaryPath } from "../../src/utils/binary.js";

const PROJECT_ROOT = join(__dirname, "../..");
const CLI_TIMEOUT_MS = 5000;

describe("Rust Integration", () => {
    let binaryPath: string | null = null;

    beforeAll(() => {
        // Resolve the binary exactly as the plugin runtime does.
        const resolved = getBinaryPath();
        binaryPath = existsSync(resolved) ? resolved : null;
    });

    // ========================================================================
    // Project Structure
    // ========================================================================

    describe("project structure", () => {
        it("should have Cargo.toml", () => {
            expect(existsSync(join(PROJECT_ROOT, "Cargo.toml"))).toBe(true);
        });

        it("should have crates directory", () => {
            expect(existsSync(join(PROJECT_ROOT, "crates"))).toBe(true);
        });

        it("should have orchestrator-cli crate", () => {
            expect(existsSync(join(PROJECT_ROOT, "crates", "orchestrator-cli"))).toBe(true);
        });

        it("should have orchestrator-core crate", () => {
            expect(existsSync(join(PROJECT_ROOT, "crates", "orchestrator-core"))).toBe(true);
        });

        it("should have Cargo.toml in each crate", () => {
            expect(existsSync(join(PROJECT_ROOT, "crates", "orchestrator-cli", "Cargo.toml"))).toBe(true);
            expect(existsSync(join(PROJECT_ROOT, "crates", "orchestrator-core", "Cargo.toml"))).toBe(true);
        });
    });

    // ========================================================================
    // CLI Execution (conditional on build)
    // ========================================================================

    describe("CLI execution", () => {
        it("should execute --help if binary exists", () => {
            if (!binaryPath) {
                return;
            }

            const result = spawnSync(binaryPath, ["--help"], { encoding: "utf-8", timeout: CLI_TIMEOUT_MS });

            expect(result.status).toBe(0);
            // Help goes to stderr so stdout stays reserved for JSON-RPC.
            expect(result.stderr.toLowerCase()).toContain("orchestrator");
        });

        it("should execute --version if binary exists", () => {
            if (!binaryPath) {
                return;
            }

            const result = spawnSync(binaryPath, ["--version"], { encoding: "utf-8", timeout: CLI_TIMEOUT_MS });

            expect(result.status).toBe(0);
            expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
        });
    });

    // ========================================================================
    // Cargo Metadata
    // ========================================================================

    describe("cargo metadata", () => {
        it("should have valid workspace configuration", () => {
            const cargoToml = join(PROJECT_ROOT, "Cargo.toml");
            expect(existsSync(cargoToml)).toBe(true);

            // Read and verify it's valid
            const content = require("fs").readFileSync(cargoToml, "utf-8");
            expect(content).toContain("[workspace]");
        });
    });
});
