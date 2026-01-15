/**
 * Git Branch Parser Tool
 *
 * Provides comprehensive Git branch information and parsing capabilities.
 * Useful for understanding current workspace context before making changes.
 */

import { tool } from "@opencode-ai/plugin";

// ============================================================================
// Types
// ============================================================================

export interface BranchInfo {
  name: string;
  current: boolean;
  isRemote: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

export interface GitStatus {
  branch: string;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  conflicted: string[];
  ahead?: number;
  behind?: number;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

// ============================================================================
// Git Branch Parser Tool
// ============================================================================

export const gitBranchTool = (directory: string) => tool({
  description: `Get Git branch information and status.

<purpose>
Analyze current Git workspace context including:
- Current branch name
- All branches (local and remote)
- Branch relationships (upstream, ahead/behind)
- Staged, unstaged, and untracked files
- Recent commits
</purpose>

<examples>
- Get current branch: Returns branch name and status
- List all branches: Shows local and remote branches
- Check status: Shows modified files
- Recent commits: Last 5 commits with file changes
</examples>

<output>
Returns structured Git information for better code decisions.
</output>`,

  args: {
    action: tool.schema.enum([
      "current",
      "list",
      "status",
      "diff",
      "recent",
      "all"
    ]).describe("Action to perform: current, list, status, diff, recent, all"),
    baseBranch: tool.schema.string().optional().describe("Base branch for comparison (e.g., 'main', 'develop'). Required for diff action."),
  },

  async execute(args) {
    const { action, baseBranch } = args;

    try {
      switch (action) {
        case "current":
          return await getCurrentBranch(directory);
        case "list":
          return await listBranches(directory);
        case "status":
          return await getGitStatus(directory);
        case "diff":
          return await getDiff(directory, baseBranch);
        case "recent":
          return await getRecentCommits(directory, 5);
        case "all":
          return await getAllInfo(directory);
        default:
          return await getCurrentBranch(directory);
      }
    } catch (error) {
      return "❌ Git error: " + (error instanceof Error ? error.message : String(error));
    }
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute git command
 */
async function execGit(directory: string, args: string[]): Promise<string> {
  const { execSync } = await import("child_process");
  try {
    return execSync("git " + args.join(" "), {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024, // 10MB
    }).toString();
  } catch (error: any) {
    if (error.status === 128) {
      throw new Error("Not a git repository");
    }
    throw error;
  }
}

/**
 * Get ahead/behind counts
 */
async function getAheadBehind(directory: string, branch: string): Promise<string> {
  try {
    const output = await execGit(directory, ["rev-list", "--left-right", "--count", branch + "...@{u}"]);

    const parts = output.trim().split(/\s+/);
    const ahead = parseInt(parts[0], 10);
    const behind = parseInt(parts[1] || "0", 10);

    const resultParts: string[] = [];
    if (ahead > 0) resultParts.push(ahead + " ahead");
    if (behind > 0) resultParts.push(behind + " behind");

    return resultParts.length > 0 ? "| **Sync** | " + resultParts.join(", ") + " |" : "";
  } catch {
    return "";
  }
}

/**
 * Get current branch name and basic info
 */
async function getCurrentBranch(directory: string): Promise<string> {
  const output = await execGit(directory, ["branch", "--show-current"]);
  const current = output.trim() || "HEAD (detached)";

  const upstream = await execGit(directory, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).catch(() => "");

  return "🌿 **Current Branch**: `" + current + "`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
         (upstream ? "| **Upstream** | `" + upstream + "` |" : "") +
         await getAheadBehind(directory, current);
}

/**
 * List all branches
 */
async function listBranches(directory: string): Promise<string> {
  const branches = await execGit(directory, ["branch", "-vv"]);

  const branchList = branches
    .split("\n")
    .filter((b) => b.trim())
    .map((b) => {
      const isCurrent = b.startsWith("*");
      const name = isCurrent ? b.substring(2).trim() : b.trim();
      const parts = name.split(/\s+/);
      const branchName = parts[0];
      const upstream = parts[1] ? parts[1].match(/\[([^\]]+)\]/)?.[1] : undefined;

      const icon = isCurrent ? "🌿" : "📂";
      const status = isCurrent ? "(current)" : "";
      const upstreamInfo = upstream ? "→ " + upstream : "";

      return icon + " `" + branchName + "` " + status + " " + upstreamInfo;
    })
    .join("\n");

  return "🌿 **All Branches**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" + branchList;
}

/**
 * Get detailed git status
 */
async function getGitStatus(directory: string): Promise<string> {
  const status = await execGit(directory, ["status", "--porcelain"]);
  const lines = status.split("\n").filter((l) => l.trim());

  if (lines.length === 0) {
    return "✅ Working directory clean";
  }

  const staged: string[] = [];
  const unstaged: string[] = [];
  const untracked: string[] = [];
  const conflicted: string[] = [];

  for (const line of lines) {
    if (!line || line.length < 2) continue;

    const statusCode = line.substring(0, 2);
    const filename = line.substring(3);

    if (statusCode === "??") {
      untracked.push(filename);
    } else if (statusCode.startsWith("U") || statusCode === "AA") {
      conflicted.push(filename);
    } else if (statusCode[0] !== " ") {
      staged.push(filename);
    }
    if (statusCode[1] !== " " && statusCode[1] !== "?") {
      unstaged.push(filename);
    }
  }

  const current = await execGit(directory, ["branch", "--show-current"]).catch(() => "unknown");

  let result = "🌿 **Branch**: `" + current + "`\n\n";

  if (staged.length > 0) {
    result += "✅ **Staged** (" + staged.length + ")\n" + staged.map(f => "  + " + f).join("\n") + "\n\n";
  }
  if (unstaged.length > 0) {
    result += "📝 **Modified** (" + unstaged.length + ")\n" + unstaged.map(f => "  ~ " + f).join("\n") + "\n\n";
  }
  if (untracked.length > 0) {
    result += "➕ **Untracked** (" + untracked.length + ")\n" + untracked.slice(0, 10).map(f => "  ? " + f).join("\n") + (untracked.length > 10 ? "\n  ... and " + (untracked.length - 10) + " more" : "") + "\n\n";
  }
  if (conflicted.length > 0) {
    result += "⚠️ **Conflicts** (" + conflicted.length + ")\n" + conflicted.map(f => "  ! " + f).join("\n") + "\n\n";
  }

  return result.trim();
}

/**
 * Get diff against base branch
 */
async function getDiff(directory: string, baseBranch?: string): Promise<string> {
  const current = await execGit(directory, ["branch", "--show-current"]).catch(() => "HEAD");
  const base = baseBranch || "main";

  const diff = await execGit(directory, ["diff", base + "..." + current, "--stat"]);

  if (!diff.trim()) {
    return "✅ No differences between `" + current + "` and `" + base + "`";
  }

  const files = await execGit(directory, ["diff", base + "..." + current, "--name-only"]);
  const fileList = files.split("\n").filter((f) => f.trim());

  return "📊 **Diff**: `" + current + "` vs `" + base + "`\n" +
         "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" + diff + "\n\n" +
         "📁 **Changed Files** (" + fileList.length + "):\n" +
         fileList.map((f, i) => "  " + (i + 1) + ". " + f).join("\n");
}

/**
 * Get recent commits
 */
async function getRecentCommits(directory: string, count: number = 5): Promise<string> {
  const log = await execGit(directory, [
    "log",
    "-" + count,
    "--pretty=format:%H|%an|%ad|%s",
    "--date=short",
    "--name-only"
  ]);

  const blocks = log.split("\n\n").filter((b) => b.trim());
  const commits: CommitInfo[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length < 2) continue;

    const [hash, author, date, message] = lines[0].split("|");
    const files = lines.slice(1);

    commits.push({
      hash: hash.substring(0, 7),
      author,
      date,
      message,
      files
    });
  }

  let result = "📜 **Recent Commits** (last " + commits.length + ")\n" +
              "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

  for (const commit of commits) {
    result += "\n🔹 `" + commit.hash + "` - " + commit.message + "\n";
    result += "   👤 " + commit.author + " | 📅 " + commit.date + "\n";
    result += "   📁 " + commit.files.length + " file" + (commit.files.length > 1 ? "s" : "") + "\n";
  }

  return result;
}

/**
 * Get all git information at once
 */
async function getAllInfo(directory: string): Promise<string> {
  const current = await getCurrentBranch(directory);
  const status = await getGitStatus(directory);
  const recent = await getRecentCommits(directory, 3);

  return "🔍 **Full Git Context**\n" +
         "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
         current + "\n\n" + status + "\n\n" + recent;
}
