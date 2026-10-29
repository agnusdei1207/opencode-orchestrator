#!/usr/bin/env node

import { readPackageJson, run } from "./lib.mjs";

const expectedBranch = process.env.OCO_RELEASE_BRANCH ?? "main";

function output(command, args) {
  return run(command, args, { capture: true }).stdout.trim();
}

const manifest = readPackageJson();
const tag = `v${manifest.version}`;
const branch = output("git", ["branch", "--show-current"]);
if (branch !== expectedBranch) throw new Error(`Release push requires branch ${expectedBranch}; current branch is ${branch}`);
if (output("git", ["status", "--porcelain"])) throw new Error("Release push requires a clean worktree");

const head = output("git", ["rev-parse", "HEAD"]);
const taggedCommit = output("git", ["rev-parse", `${tag}^{commit}`]);
if (head !== taggedCommit) throw new Error(`${tag} does not point to HEAD`);

run("git", ["push", "--atomic", "origin", expectedBranch, `refs/tags/${tag}`]);
console.log(`[release-push] atomically pushed ${expectedBranch} and ${tag}`);
