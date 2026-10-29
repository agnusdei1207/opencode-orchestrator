#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { run, runNpm } from "./lib.mjs";

const skipCli = process.argv.includes("--skip-cli");

function parsePackResult(stdout) {
  const parsed = JSON.parse(stdout.trim());
  const packed = Array.isArray(parsed) ? parsed[0] : undefined;
  if (!packed?.filename || !packed?.shasum || !packed?.name || !packed?.version) {
    throw new Error("npm pack did not return package metadata");
  }
  return packed;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function runInstalledCli(consumer, installedRoot, flag) {
  // The .cmd shim cannot be spawned without a shell on Windows.
  if (process.platform === "win32") {
    return run(process.execPath, [path.join(installedRoot, "dist", "cli.js"), flag], { cwd: consumer, capture: true });
  }
  return run(path.join(consumer, "node_modules", ".bin", "orchestrator"), [flag], { cwd: consumer, capture: true });
}

function checkCli(consumer, installedRoot, version) {
  const npmBin = path.join(consumer, "node_modules", ".bin", process.platform === "win32" ? "orchestrator.cmd" : "orchestrator");
  if (!existsSync(npmBin)) throw new Error(`npm did not create the orchestrator command: ${npmBin}`);
  const cliVersion = runInstalledCli(consumer, installedRoot, "--version").stdout.trim();
  if (cliVersion !== version) {
    throw new Error(`CLI version ${cliVersion || "(empty)"} does not match package ${version}`);
  }
  runInstalledCli(consumer, installedRoot, "--help");
}

const temporaryRoot = mkdtempSync(path.join(tmpdir(), "opencode-orchestrator-smoke-"));

try {
  const packed = parsePackResult(runNpm([
    "pack",
    "--json",
    "--silent",
    "--ignore-scripts",
    "--pack-destination",
    temporaryRoot,
  ], { capture: true }).stdout);
  const tarball = path.join(temporaryRoot, packed.filename);
  const consumer = path.join(temporaryRoot, "consumer");
  mkdirSync(consumer);
  writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ private: true }, null, 2));

  runNpm(["install", tarball, "--no-audit", "--no-fund"], { cwd: consumer, capture: true });

  const smokeModule = path.join(consumer, "smoke.mjs");
  writeFileSync(smokeModule, `
import * as root from "opencode-orchestrator";
if (JSON.stringify(Object.keys(root).sort()) !== JSON.stringify(["default"])) throw new Error("unexpected root exports");
if (JSON.stringify(Object.keys(root.default).sort()) !== JSON.stringify(["id", "setup"])) throw new Error("plugin must expose only id and setup");
if (root.default.id !== "opencode-orchestrator") throw new Error("plugin id is missing");
if (typeof root.default.setup !== "function") throw new Error("OpenCode 2 setup entry is missing");
`);
  run(process.execPath, [smokeModule], { cwd: consumer, capture: true });

  const installedRoot = path.join(consumer, "node_modules", "opencode-orchestrator");
  // @opencode/plugin is a devDependency (types only); it must not be required at runtime.
  const devOnlyPluginContract = path.join(consumer, "node_modules", "@opencode", "plugin");
  if (existsSync(devOnlyPluginContract)) {
    throw new Error("development-only @opencode/plugin leaked into the packed install");
  }
  const installedManifest = JSON.parse(readFileSync(path.join(installedRoot, "package.json"), "utf8"));
  if (installedManifest.bin?.orchestrator !== "dist/cli.js") {
    throw new Error("installed package does not expose the orchestrator CLI");
  }
  if (!skipCli) checkCli(consumer, installedRoot, installedManifest.version);

  runNpm(["ls", "--depth=0"], { cwd: consumer, capture: true });
  console.log(JSON.stringify({
    package: `${installedManifest.name}@${installedManifest.version}`,
    files: packed.files?.length,
    packedBytes: packed.size,
    unpackedBytes: packed.unpackedSize,
    sha1: packed.shasum,
    sha256: sha256(tarball),
    cli: skipCli ? "skipped" : "passed",
  }));
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
