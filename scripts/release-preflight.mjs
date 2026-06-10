import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

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

function readPackageJson() {
  return JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
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
  const result = run(npmCommand, ["view", spec, "version", "--json"], {
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
run(npmCommand, ["run", "build"]);

console.log("[release-preflight] running tests");
run(npmCommand, ["test"]);

console.log("[release-preflight] running Rust tests");
run("cargo", ["test", "--workspace", "--all-targets"]);

console.log("[release-preflight] running npm audit");
run(npmCommand, ["audit", "--json"]);

console.log("[release-preflight] checking package contents");
run(npmCommand, ["pack", "--dry-run"]);

console.log("[release-preflight] passed");
