import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// On Windows npm is a .cmd shim that spawnSync cannot run without a shell, so
// run npm's JS entry point with the current Node binary instead.
const npmCliPath = process.env.npm_execpath
  ?? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmPrefix = process.platform === "win32" ? [npmCliPath] : [];

/**
 * Runs a command synchronously without a shell.
 * Options: cwd (default repo root), env, capture (pipe instead of inherit),
 * allowFailure (return a non-zero result instead of throwing).
 */
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
    env: options.env ?? process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = result.stderr?.trim()
      || (result.signal ? `signal ${result.signal}` : `exit code ${result.status}`);
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
  return result;
}

export function runNpm(args, options = {}) {
  return run(npmCommand, [...npmPrefix, ...args], options);
}

export function commandIsAvailable(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", stdio: "pipe", shell: false });
  return !result.error && result.status === 0;
}

export function readPackageJson() {
  return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
}
