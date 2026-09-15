import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const verifier = path.join(repoRoot, "scripts", "verify-release-artifacts.mjs");
const version = "9.8.7";
const temporaryDirectories: string[] = [];

type ArtifactFormat = "elf" | "mach-o" | "pe";

const artifacts: Array<{ name: string; format: ArtifactFormat; machine: number }> = [
    { name: "orchestrator-linux-x64", format: "elf", machine: 0x3e },
    { name: "orchestrator-linux-arm64", format: "elf", machine: 0xb7 },
    { name: "orchestrator-macos-x64", format: "mach-o", machine: 0x01000007 },
    { name: "orchestrator-macos-arm64", format: "mach-o", machine: 0x0100000c },
    { name: "orchestrator-windows-x64.exe", format: "pe", machine: 0x8664 },
];

function fixtureDirectory(): string {
    const directory = mkdtempSync(path.join(tmpdir(), "orchestrator-artifacts-"));
    temporaryDirectories.push(directory);
    for (const artifact of artifacts) {
        writeFileSync(path.join(directory, artifact.name), artifactBuffer(artifact.format, artifact.machine));
    }
    return directory;
}

function artifactBuffer(format: ArtifactFormat, machine: number): Buffer {
    const buffer = Buffer.alloc(256);
    if (format === "elf") {
        buffer.set([0x7f, 0x45, 0x4c, 0x46, 2, 1], 0);
        buffer.writeUInt16LE(machine, 18);
    } else if (format === "mach-o") {
        buffer.writeUInt32LE(0xfeedfacf, 0);
        buffer.writeUInt32LE(machine, 4);
    } else {
        buffer.write("MZ", 0, "ascii");
        buffer.writeUInt32LE(64, 0x3c);
        buffer.write("PE\0\0", 64, "ascii");
        buffer.writeUInt16LE(machine, 68);
    }
    buffer.write(version, 128, "ascii");
    return buffer;
}

afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
        rmSync(directory, { recursive: true, force: true });
    }
});

describe("release artifact verifier", () => {
    it("accepts one version-matched binary for every supported target", () => {
        const directory = fixtureDirectory();
        const output = execFileSync(process.execPath, [verifier, "--directory", directory, "--version", version], {
            encoding: "utf8",
        });

        expect(output).toContain("verified 5 release artifacts");
    });

    it("rejects missing, unexpected, wrong-architecture, and stale-version artifacts", () => {
        const cases: Array<(directory: string) => void> = [
            directory => rmSync(path.join(directory, artifacts[0].name)),
            directory => writeFileSync(path.join(directory, "orchestrator-linux-riscv64"), Buffer.alloc(256)),
            directory => writeFileSync(path.join(directory, artifacts[0].name), artifactBuffer("elf", 0xb7)),
            directory => {
                const stale = artifactBuffer("elf", 0x3e);
                stale.fill(0, 128, 128 + version.length);
                stale.write("9.8.6", 128, "ascii");
                writeFileSync(path.join(directory, artifacts[0].name), stale);
            },
        ];

        for (const mutate of cases) {
            const directory = fixtureDirectory();
            mutate(directory);
            const result = spawnSync(process.execPath, [verifier, "--directory", directory, "--version", version], {
                encoding: "utf8",
            });
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("release artifact verification failed");
        }
    });
});
