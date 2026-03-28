#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VALID_HOOKS = new Set(["postinstall", "preuninstall"]);

function resolveRepoRoot() {
  const scriptPath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(scriptPath), "..");
}

function resolveHookCommand(repoRoot, hookName) {
  const distEntry = path.join(repoRoot, "dist", "scripts", `${hookName}.js`);
  if (existsSync(distEntry)) {
    return {
      command: process.execPath,
      args: [distEntry],
    };
  }

  const sourceEntry = path.join(repoRoot, "scripts", `${hookName}.ts`);
  if (existsSync(sourceEntry)) {
    return {
      command: process.execPath,
      args: ["--experimental-strip-types", sourceEntry],
    };
  }

  return null;
}

function main() {
  const hookName = process.argv[2];
  if (!VALID_HOOKS.has(hookName)) {
    console.error(`Unknown install hook: ${hookName ?? "(missing)"}`);
    process.exit(1);
  }

  const repoRoot = resolveRepoRoot();
  const hookCommand = resolveHookCommand(repoRoot, hookName);

  if (!hookCommand) {
    console.log(`⚠️  ${hookName} entrypoint not found. Skipping gracefully.`);
    process.exit(0);
  }

  const result = spawnSync(hookCommand.command, hookCommand.args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(`Failed to run ${hookName}: ${result.error.message}`);
  }
  process.exit(1);
}

main();
