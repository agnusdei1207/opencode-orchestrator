import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const readmePath = path.join(repoRoot, "README.md");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const readme = readFileSync(readmePath, "utf8");
const versionLine = `  <!-- VERSION:START -->
  **Version:** \`${packageJson.version}\`
  <!-- VERSION:END -->`;
const versionBlockPattern = /  <!-- VERSION:START -->(?:\r?\n|\\n|\n)[\s\S]*?(?:\r?\n|\\n|\n)  <!-- VERSION:END -->/;

if (!versionBlockPattern.test(readme)) {
  throw new Error("README.md is missing the VERSION marker block.");
}

const nextReadme = readme.replace(versionBlockPattern, versionLine);

if (nextReadme !== readme) {
  writeFileSync(readmePath, nextReadme);
}

if (process.argv.includes("--stage")) {
  const result = spawnSync("git", ["add", "README.md"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`git add README.md failed with exit code ${result.status}`);
  }
}
