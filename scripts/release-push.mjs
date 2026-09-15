#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedBranch = process.env.OCO_RELEASE_BRANCH ?? "main";

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message
      || result.stderr?.trim()
      || (result.signal ? `signal ${result.signal}` : `exit code ${result.status}`);
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout?.trim() ?? "";
}

const manifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const tag = `v${manifest.version}`;
const branch = run("git", ["branch", "--show-current"], true);
if (branch !== expectedBranch) throw new Error(`Release push requires branch ${expectedBranch}; current branch is ${branch}`);
if (run("git", ["status", "--porcelain"], true)) throw new Error("Release push requires a clean worktree");

const head = run("git", ["rev-parse", "HEAD"], true);
const taggedCommit = run("git", ["rev-parse", `${tag}^{commit}`], true);
if (head !== taggedCommit) throw new Error(`${tag} does not point to HEAD`);

run("git", ["push", "--atomic", "origin", expectedBranch, `refs/tags/${tag}`]);
console.log(`[release-push] atomically pushed ${expectedBranch} and ${tag}`);
