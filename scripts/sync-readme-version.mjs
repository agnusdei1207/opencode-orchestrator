import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readPackageJson, repoRoot } from "./lib.mjs";

const readmePath = path.join(repoRoot, "README.md");
const readme = readFileSync(readmePath, "utf8");
const versionBlock = `  <!-- VERSION:START -->
  **Version:** \`${readPackageJson().version}\`
  <!-- VERSION:END -->`;
const versionBlockPattern = /  <!-- VERSION:START -->\r?\n[\s\S]*?\r?\n  <!-- VERSION:END -->/;

if (!versionBlockPattern.test(readme)) {
  throw new Error("README.md is missing the VERSION marker block.");
}

const nextReadme = readme.replace(versionBlockPattern, versionBlock);
if (nextReadme !== readme) {
  writeFileSync(readmePath, nextReadme);
}
