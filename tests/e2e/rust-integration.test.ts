/**
 * Rust Integration Tests
 * 
 * Tests for Rust/TypeScript integration:
 * - Binary detection
 * - CLI execution (if binary exists)
 * - File structure verification
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(__dirname, "../..");
const RUST_TARGET_DIR = join(PROJECT_ROOT, "target");

describe("Rust Integration", () => {
    let binaryPath: string | null = null;

    beforeAll(() => {
        // Find available binary
        const releasePath = join(RUST_TARGET_DIR, "release", "orchestrator-cli");
        const debugPath = join(RUST_TARGET_DIR, "debug", "orchestrator-cli");

        if (existsSync(releasePath)) {
            binaryPath = releasePath;
        } else if (existsSync(debugPath)) {
            binaryPath = debugPath;
        }
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

            const result = execSync(`${binaryPath} --help`, {
                encoding: "utf-8",
                timeout: 5000,
            });

            expect(result.toLowerCase()).toContain("orchestrator");
        });

        it("should execute --version if binary exists", () => {
            if (!binaryPath) {
                return;
            }

            const result = execSync(`${binaryPath} --version`, {
                encoding: "utf-8",
                timeout: 5000,
            });

            expect(result).toMatch(/\d+\.\d+\.\d+/);
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
