import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));

const npmCliPath = process.env.npm_execpath
  ?? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmCommandPrefix = process.platform === "win32" ? [npmCliPath] : [];

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const detail = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
    throw new Error(`${command} ${commandArgs.join(" ")} failed with ${detail}`);
  }

  return result;
}

function runNpm(commandArgs, options = {}) {
  return run(npmCommand, [...npmCommandPrefix, ...commandArgs], options);
}

function readPackageJson() {
  return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
}

function commandIsAvailable(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
  });
  return !result.error && result.status === 0;
}

function runRustTests() {
  const cargoArgs = ["test", "--workspace", "--all-targets"];
  if (commandIsAvailable("cargo", ["--version"])) {
    run("cargo", cargoArgs);
    return;
  }

  console.log("[release-preflight] cargo unavailable; using Docker");
  run("docker", ["compose", "run", "--rm", "--no-deps", "test", "cargo", ...cargoArgs]);
}

function assertCleanWorktree() {
  if (args.has("--allow-dirty")) {
    return;
  }

  const result = run("git", ["status", "--porcelain"], { capture: true });
  if (result.stdout.trim()) {
    throw new Error("Release preflight requires a clean git worktree.");
  }
}

function assertBranch() {
  if (args.has("--skip-branch")) {
    return;
  }

  const expected = process.env.OCO_RELEASE_BRANCH ?? "main";
  const result = run("git", ["branch", "--show-current"], { capture: true });
  const current = result.stdout.trim();
  if (current !== expected) {
    throw new Error(`Release preflight requires branch ${expected}; current branch is ${current}.`);
  }
}

function assertVersionIsUnpublished() {
  if (args.has("--skip-version-check")) {
    return;
  }

  const packageJson = readPackageJson();
  const spec = `${packageJson.name}@${packageJson.version}`;
  const result = runNpm(["view", spec, "version", "--json"], {
    allowFailure: true,
    capture: true,
  });

  if (result.status === 0 && result.stdout.trim()) {
    throw new Error(`${spec} already exists in the npm registry.`);
  }
}

console.log("[release-preflight] checking git state");
assertCleanWorktree();
assertBranch();
assertVersionIsUnpublished();

console.log("[release-preflight] running build");
runNpm(["run", "build"]);

console.log("[release-preflight] running tests");
runNpm(["test"]);

console.log("[release-preflight] running Rust tests");
runRustTests();

console.log("[release-preflight] running npm audit");
runNpm(["audit", "--json"]);

console.log("[release-preflight] checking package contents");
runNpm(["pack", "--dry-run"]);

console.log("[release-preflight] passed");
