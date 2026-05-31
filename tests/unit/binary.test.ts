import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { arch, platform } from "node:os";
import path from "node:path";
import {
    getCandidateBinDirs,
    getPlatformBinaryName,
    resolveBinaryPath,
} from "../../src/utils/binary.js";

const repoRoot = path.resolve(__dirname, "../..");

describe("binary path resolution", () => {
    it("prefers package-local bin next to bundled dist output", () => {
        const moduleDir = path.join(repoRoot, "dist");
        const expectedBinDir = path.join(repoRoot, "bin");

        expect(getCandidateBinDirs(moduleDir)[0]).toBe(expectedBinDir);
    });

    it("falls back from source layout to repository bin", () => {
        const moduleDir = path.join(repoRoot, "src", "utils");
        const expectedBinDir = path.join(repoRoot, "bin");

        expect(getCandidateBinDirs(moduleDir)[1]).toBe(expectedBinDir);
    });

    it("selects the platform binary before generic fallback", () => {
        const moduleDir = path.join(repoRoot, "dist");
        const binaryName = getPlatformBinaryName("linux", "x64");
        const expectedPath = path.join(repoRoot, "bin", binaryName);

        const resolved = resolveBinaryPath({
            moduleDir,
            os: "linux",
            cpu: "x64",
            exists: (candidate) => candidate === expectedPath,
        });

        expect(resolved).toBe(expectedPath);
    });

    it("keeps source-checkout fallback for generic development binary", () => {
        const moduleDir = path.join(repoRoot, "src", "utils");
        const fallbackPath = path.join(repoRoot, "bin", "orchestrator");

        const resolved = resolveBinaryPath({
            moduleDir,
            os: "linux",
            cpu: "x64",
            exists: (candidate) => candidate === fallbackPath,
        });

        expect(resolved).toBe(fallbackPath);
    });
});

describe("packaged Linux x64 artifact", () => {
    it("is an x86-64 ELF on Linux x64 hosts", () => {
        if (platform() !== "linux" || arch() !== "x64") {
            return;
        }

        const binaryPath = path.join(repoRoot, "bin", "orchestrator-linux-x64");
        expect(existsSync(binaryPath)).toBe(true);

        const output = execFileSync("file", [binaryPath], { encoding: "utf8" });
        expect(output).toContain("ELF 64-bit");
        expect(output).toContain("x86-64");
        expect(output).not.toContain("ARM aarch64");
    });
});
