#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  { name: "orchestrator-linux-x64", format: "elf", machine: 0x3e },
  { name: "orchestrator-linux-arm64", format: "elf", machine: 0xb7 },
  { name: "orchestrator-macos-x64", format: "mach-o", machine: 0x01000007 },
  { name: "orchestrator-macos-arm64", format: "mach-o", machine: 0x0100000c },
  { name: "orchestrator-windows-x64.exe", format: "pe", machine: 0x8664 },
];

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function packageVersion() {
  return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).version;
}

function assertExactArtifactSet(directory) {
  const actual = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const expected = targets.map((target) => target.name).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`expected ${expected.join(", ")}; found ${actual.join(", ") || "none"}`);
  }
}

function assertElf(buffer, target) {
  if (buffer.length < 20 || !buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    throw new Error(`${target.name} is not an ELF binary`);
  }
  if (buffer[4] !== 2 || buffer[5] !== 1 || buffer.readUInt16LE(18) !== target.machine) {
    throw new Error(`${target.name} has the wrong ELF class, byte order, or architecture`);
  }
}

function assertMachO(buffer, target) {
  if (buffer.length < 8 || buffer.readUInt32LE(0) !== 0xfeedfacf) {
    throw new Error(`${target.name} is not a 64-bit little-endian Mach-O binary`);
  }
  if (buffer.readUInt32LE(4) !== target.machine) {
    throw new Error(`${target.name} has the wrong Mach-O architecture`);
  }
}

function assertPe(buffer, target) {
  if (buffer.length < 70 || buffer.toString("ascii", 0, 2) !== "MZ") {
    throw new Error(`${target.name} is not a PE binary`);
  }
  const peOffset = buffer.readUInt32LE(0x3c);
  if (peOffset + 6 > buffer.length || buffer.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") {
    throw new Error(`${target.name} has an invalid PE header`);
  }
  if (buffer.readUInt16LE(peOffset + 4) !== target.machine) {
    throw new Error(`${target.name} has the wrong PE architecture`);
  }
}

function assertTarget(directory, target, version) {
  const buffer = readFileSync(path.join(directory, target.name));
  if (target.format === "elf") assertElf(buffer, target);
  else if (target.format === "mach-o") assertMachO(buffer, target);
  else assertPe(buffer, target);

  if (!buffer.includes(Buffer.from(version, "ascii"))) {
    throw new Error(`${target.name} does not embed package version ${version}`);
  }
}

function main() {
  const directory = path.resolve(argumentValue("--directory") ?? path.join(repoRoot, "bin"));
  const version = argumentValue("--version") ?? packageVersion();
  if (!version) throw new Error("package version is empty");

  assertExactArtifactSet(directory);
  for (const target of targets) assertTarget(directory, target, version);
  console.log(`[verify-release-artifacts] verified ${targets.length} release artifacts for ${version}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[verify-release-artifacts] release artifact verification failed: ${message}`);
  process.exitCode = 1;
}
