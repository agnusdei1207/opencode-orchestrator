import { describe, expect, it } from "vitest";
import path from "node:path";
import {
    getCandidateBinDirs,
    getPlatformBinaryName,
    resolveBinaryPath,
} from "../../src/utils/binary.js";

const repoRoot = path.resolve(__dirname, "../..");

describe("binary path resolution", () => {
    it.each([
        ["linux", "x64", "orchestrator-linux-x64"],
        ["linux", "arm64", "orchestrator-linux-arm64"],
        ["darwin", "x64", "orchestrator-macos-x64"],
        ["darwin", "arm64", "orchestrator-macos-arm64"],
        ["win32", "x64", "orchestrator-windows-x64.exe"],
    ])("maps %s-%s to its packaged artifact", (os, cpu, expected) => {
        expect(getPlatformBinaryName(os, cpu)).toBe(expected);
    });

    it.each([
        ["win32", "arm64"],
        ["linux", "ia32"],
        ["freebsd", "x64"],
    ])("rejects unsupported target %s-%s instead of launching an incompatible binary", (os, cpu) => {
        expect(() => getPlatformBinaryName(os, cpu)).toThrow(`Unsupported platform: ${os}-${cpu}`);
    });

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
