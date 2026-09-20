#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipCli = process.argv.includes("--skip-cli");
const npmCliPath = process.env.npm_execpath
  ?? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmPrefix = process.platform === "win32" ? [npmCliPath] : [];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
    env: options.env ?? process.env,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message
      || result.stderr?.trim()
      || (result.signal ? `signal ${result.signal}` : `exit code ${result.status}`);
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
  return result;
}

function runNpm(args, options = {}) {
  return run(npmCommand, [...npmPrefix, ...args], options);
}

function parsePackResult(stdout) {
  const parsed = JSON.parse(stdout.trim());
  const packed = Array.isArray(parsed) ? parsed[0] : undefined;
  if (!packed?.filename || !packed?.shasum) {
    throw new Error("npm pack did not return package metadata");
  }
  return packed;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
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
  const configRoot = path.join(temporaryRoot, "opencode-config");
  mkdirSync(consumer);
  writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ private: true }, null, 2));

  runNpm(["install", tarball, "--no-audit", "--no-fund"], {
    cwd: consumer,
    capture: true,
    env: {
      ...process.env,
      CI: "false",
      CONTINUOUS_INTEGRATION: "false",
      OPENCODE_CONFIG_DIR: configRoot,
      XDG_CONFIG_HOME: path.join(temporaryRoot, "xdg"),
      XDG_CACHE_HOME: path.join(temporaryRoot, "cache"),
      APPDATA: path.join(temporaryRoot, "appdata"),
      USERPROFILE: path.join(temporaryRoot, "home"),
      HOME: path.join(temporaryRoot, "home"),
    },
  });

  const installedConfig = JSON.parse(readFileSync(path.join(configRoot, "opencode.jsonc"), "utf8"));
  if (!installedConfig.plugin?.includes("opencode-orchestrator")) {
    throw new Error("packed postinstall did not register the plugin in the isolated config");
  }

  const smokeModule = path.join(consumer, "smoke.mjs");
  writeFileSync(smokeModule, `
import * as root from "opencode-orchestrator";
import * as server from "opencode-orchestrator/server";
if (JSON.stringify(Object.keys(root).sort()) !== JSON.stringify(["default"])) throw new Error("unexpected root exports");
if (JSON.stringify(Object.keys(server).sort()) !== JSON.stringify(["default"])) throw new Error("unexpected server exports");
if (root.default !== server.default) throw new Error("plugin entrypoints diverged");
if (root.default.id !== "opencode-orchestrator") throw new Error("plugin id is missing");
if (typeof root.default.server !== "function") throw new Error("OpenCode 1 server entry is missing");
if (typeof root.default.setup !== "function") throw new Error("OpenCode 2 setup entry is missing");
`);
  run(process.execPath, [smokeModule], { cwd: consumer, capture: true });

  const installedRoot = path.join(consumer, "node_modules", "opencode-orchestrator");
  const leakedV2Contract = path.join(consumer, "node_modules", "@opencode", "plugin");
  if (existsSync(leakedV2Contract)) {
    throw new Error("development-only OpenCode 2 contract leaked into the packed install");
  }
  const installedManifest = JSON.parse(readFileSync(path.join(installedRoot, "package.json"), "utf8"));
  if (installedManifest.bin?.orchestrator !== "dist/cli.js") {
    throw new Error("installed package does not expose the orchestrator CLI");
  }

  if (!skipCli) {
    const npmBin = path.join(consumer, "node_modules", ".bin", process.platform === "win32" ? "orchestrator.cmd" : "orchestrator");
    if (!existsSync(npmBin)) throw new Error(`npm did not create the orchestrator command: ${npmBin}`);
    const cliCommand = process.platform === "win32" ? process.execPath : npmBin;
    const cliArgs = process.platform === "win32"
      ? [path.join(installedRoot, "dist", "cli.js"), "--version"]
      : ["--version"];
    const cliVersion = run(cliCommand, cliArgs, { cwd: consumer, capture: true }).stdout.trim();
    if (cliVersion !== installedManifest.version) {
      throw new Error(`CLI version ${cliVersion || "(empty)"} does not match package ${installedManifest.version}`);
    }
  }

  runNpm(["ls", "--depth=0"], { cwd: consumer, capture: true });
  console.log(JSON.stringify({
    package: `${installedManifest.name}@${installedManifest.version}`,
    files: packed.files?.length,
    packedBytes: packed.size,
    unpackedBytes: packed.unpackedSize,
    sha1: packed.shasum,
    sha256: sha256(tarball),
    postinstall: "passed",
    cli: skipCli ? "skipped" : "passed",
  }));
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
