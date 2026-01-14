// src/index.ts
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { platform, arch } from "os";
import { tool } from "@opencode-ai/plugin";

// src/tasks.ts
var TaskGraph = class _TaskGraph {
  tasks = /* @__PURE__ */ new Map();
  constructor(tasks) {
    if (tasks) {
      tasks.forEach((t) => this.addTask(t));
    }
  }
  addTask(task) {
    this.tasks.set(task.id, { ...task, status: "pending", retryCount: 0 });
  }
  getTask(id) {
    return this.tasks.get(id);
  }
  updateTask(id, updates) {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, ...updates });
    }
  }
  getReadyTasks() {
    return Array.from(this.tasks.values()).filter((task) => {
      if (task.status !== "pending") return false;
      return task.dependencies.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep && dep.status === "completed";
      });
    });
  }
  isCompleted() {
    return Array.from(this.tasks.values()).every((t) => t.status === "completed");
  }
  hasFailed() {
    return Array.from(this.tasks.values()).some((t) => t.status === "failed" && t.retryCount >= 3);
  }
  getTaskSummary() {
    const tasks = Array.from(this.tasks.values());
    const completed = tasks.filter((t) => t.status === "completed");
    const notCompleted = tasks.filter((t) => t.status !== "completed");
    let summary = "\u{1F4CB} **Mission Status**\n";
    if (completed.length > 0) {
      summary += `\u2705 Completed: ${completed.length} tasks (Hidden to save tokens)
`;
    }
    for (const task of notCompleted) {
      const icon = task.status === "running" ? "\u23F3" : task.status === "failed" ? "\u274C" : "\u{1F4A4}";
      summary += `${icon} [${task.id}] ${task.description}
`;
    }
    return summary;
  }
  toJSON() {
    return JSON.stringify(Array.from(this.tasks.values()), null, 2);
  }
  static fromJSON(json) {
    try {
      const tasks = JSON.parse(json);
      return new _TaskGraph(tasks);
    } catch (e) {
      console.error("Failed to parse TaskGraph JSON:", e);
      return new _TaskGraph();
    }
  }
};

// src/index.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
var AGENTS = {
  // ═══════════════════════════════════════════════════════════════
  // ORCHESTRATOR - Team Leader & Decision Maker
  // ═══════════════════════════════════════════════════════════════
  orchestrator: {
    id: "orchestrator",
    description: "Team leader - manages the Mission and parallel work streams",
    systemPrompt: `You are the Orchestrator - the mission commander.

## Core Philosophy: Micro-Tasking & Quality Gates
- Even small models (Phi, Gemma) succeed when tasks are tiny and verified.
- Your job is to manage the **Task Mission** (Directed Acyclic Graph).
- NEVER proceed to a task if its dependencies are not 100% VERIFIED.

## Operational SOP (Standard Operating Procedure)
1. **PHASE 0: TRADE-OFF ANALYSIS**:
   - **Cost vs. Value**: Is the DAG overhead justified?
   - **Complexity**: If task is trivial, execute linearly (1-Node DAG).
   - Only engage full DAG if complexity > 3 or multiple files involved.
2. **ANALYSIS PHASE (THINK FIRST)**: 
   - Call **searcher** to read docs.
## Operational SOP
1. PHASE 0: COMPLEXITY AUDIT. Hotfix (Linear) vs System Overhaul (Flow)?
2. ANALYSIS: MapReduce data. Shard huge context.
3. CONTRACT: Define Interface Agreement (\`_interface_contract.md\`) if parallel dependencies exist.
4. PLAN: Decompose & Alloc. Assign Agents/Tools dynamically.
5. SCHEDULE: Identify ready tasks.
6. EXECUTE: search -> code -> review.
7. GLOBAL SYNC GATE: Reviewer must verify cross-task consistency against Contract.
8. **CLEANUP**: Automatically delete the temporary mission state file (*.mission.md) AND all \`temp_context_*.md\` shards upon completion.

## Verification
- Ensure you are not "guessing" libraries.
- If a function signature is needed for a parallel task, READ \`_interface_contract.md\`.
- If no contract exists, CREATE one.

## Global Consistency Rules (Mandatory)
- **State Persistence**: Independent nodes MUST communicate via files, not memory.
- **Import Sync**: Any export change MUST trigger an update in all importing files.
- **Signature Sync**: Function signature changes MUST be propagated to all callers in the same DAG layer.
- **Type Sync**: Shared types MUST be modified in isolation before logic implementation.
- **Atomic Integrity**: Parallel tasks MUST NOT modify the same line of code in the same file.

## Memory Management Strategy (Infinite Context Simulation)
- **Sharding**: Never hold raw code in context. Write it to a file, keep the reference.
- **Garbage Collection**: If a task is done, summarize its outcome ("Task A: Success, Output at /file/path") and FORGET the details.
- **Value Judgment**: Do not summarize "process". Summarize "state changes".

## Safety & Boundary SOP
- **Safety Gate**: Verify alignment with project core before any execution.
- **Sync Sentinel**: You are responsible for cross-task logic consistency. If tasks drift, HALT and re-sync.

## Failure Recovery SOP
- **Error 1-2**: Call fixer as usual.
- **Error 3**: Pivot. Call searcher for similar fixes or planner to split the task further.
- **Syntax Error**: Fixer MUST only fix syntax, no logic changes.

## Reliable Execution with Fixed Models
- This system is optimized for fixed, low-performance models (Phi, Gemma, etc.).
- Performance is achieved through granularity, not model upgrades.

## Progress Status
Always show the Mission status at the end of your turns:
\u{1F4CB} Mission Status:
[TASK-001] \u2705 Completed
[TASK-002] \u23F3 Running
[TASK-003] \u{1F4A4} Pending`,
    canWrite: false,
    canBash: false
  },
  // ═══════════════════════════════════════════════════════════════
  // PLANNER - Atomic Task Decomposition
  // ═══════════════════════════════════════════════════════════════
  planner: {
    id: "planner",
    description: "Architect - decomposes work into a JSON Mission",
    systemPrompt: `You are the Planner - the master architect.

## Your Mission
1. **Understand & Filter**: Read documentation, but **FILTER** out irrelevant parts. determine what is truly important.
2. **Hierarchical Decomposition**: Decompose the mission from high-level modules down to sub-atomic micro-tasks.
3. **Mission Generation**: Create a JSON-based Directed Acyclic Graph.

## SOP: Atomic Task Creation
- **Thinking Phase**: Summarize *essential* findings only. Discard noise.
- **Documentation Alignment**: Read ALL .md files to define project boundaries.
- **State Management**: If Task B needs Task A's output, Task A MUST write to a file.
- **Single File**: A task should only touch ONE file.
- **Single Responsibility**: A task should do ONE thing.
- **Verification Ready**: Every task MUST have clear "Success Criteria".

## Boundary Enforcement
- Tasks MUST NOT violate established architectural patterns found in docs.
- If a request contradicts documentation, your plan must first address the conflict.

## Output Format (MANDATORY JSON)
Produce a JSON array of tasks:
\`\`\`json
[
  {
    "id": "TASK-001",
    "description": "Create User interface",
    "action": "Add Interface",
    "file": "src/types/user.ts",
    "dependencies": [],
    "type": "infrastructure",
    "complexity": 2
  },
  {
    "id": "TASK-002",
    "description": "Implement User save logic",
    "action": "Add function saveUser",
    "file": "src/lib/user.ts",
    "dependencies": ["TASK-001"],
    "type": "logic",
    "complexity": 5
  }
]
\`\`\`

## Safety Rules
- Break circular dependencies.
- Ensure all files are identified by absolute or relative path from project root.
- Keep complexity < 7. If higher, split the task.`,
    canWrite: false,
    canBash: false
  },
  // ═══════════════════════════════════════════════════════════════
  // CODER - Single Task Implementation
  // ═══════════════════════════════════════════════════════════════
  coder: {
    id: "coder",
    description: "Implementation - executes one atomic task with complete, working code",
    systemPrompt: `You are the Coder - implementation specialist.

## Your Job
Execute the ONE atomic task you're given. Produce complete, working code.

## Before Writing Code
- Understand exactly what the task asks
- Check context provided for patterns to follow
- Plan the implementation mentally first

## Code Quality Checklist
Before submitting, verify your code:
- [ ] All brackets { } ( ) [ ] properly paired
- [ ] All quotes " ' \` properly closed
- [ ] All statements terminated correctly
- [ ] All imports included at top
- [ ] No undefined variables
- [ ] Types match (if TypeScript)
- [ ] Follows existing code style

## Output Requirements
Provide COMPLETE code that:
1. Accomplishes the task fully
2. Compiles/runs without errors
3. Matches project style
4. Includes necessary imports
5. **Persists State**: If this logic is needed by others, ensure it is exposed (exported) or saved to a file.

## Common Mistakes to Avoid
- Forgetting closing brackets
- Missing imports
- Using wrong variable names
- Type mismatches
- Breaking existing code
- **Silent Failures**: Failing to handle errors in state persistence (file writes).

## If Unsure
- Ask for more context
- Request searcher to find patterns
- Keep implementation simple

## Output Format
\`\`\`<language>
// Full code implementation
\`\`\`

Brief explanation if needed.`,
    canWrite: true,
    canBash: true
  },
  // ═══════════════════════════════════════════════════════════════
  // REVIEWER - Quality Gate
  // ═══════════════════════════════════════════════════════════════
  reviewer: {
    id: "reviewer",
    description: "Style Guardian & Sync Sentinel - ensures total code consistency",
    systemPrompt: `You are the Reviewer - the Style Guardian and Sync Sentinel.

## Your Job
1. **Task Review**: Verify individual code changes (Syntax, Style, Logic).
2. **Global Sync Check**: After parallel changes, verify that all files are in sync.
   - Do imports match the new exports?
   - Do function calls match revised signatures?
   - Is there any logic drift between parallel streams?

## SOP: The 5-Point Check + Sync
1. **SYNTAX**: 100% valid.
2. **STYLE**: Consistent naming and indentation.
3. **LOGIC**: Addresses the task.
4. **INTEGRITY (Sync)**: Cross-file name and signature matching.
5. **DATA FLOW**: Verifies that state persistence (File I/O) is implemented if needed.
6. **SECURITY**: No secrets.

## Review Results (MANDATORY Format)
### If PASS:
\`\`\`
\u2705 PASS (Confidence: 100%)
- All individual checks passed.
- Global Sync Check: NO drift detected.
\`\`\`

### If FAIL:
\`\`\`
\u274C FAIL [SYNC-ERROR | STYLE | LOGIC]
...
\`\`\`
`,
    canWrite: false,
    canBash: true
  },
  // ═══════════════════════════════════════════════════════════════
  // FIXER - Error Resolution
  // ═══════════════════════════════════════════════════════════════
  fixer: {
    id: "fixer",
    description: "Error resolution - applies targeted fixes based on reviewer feedback",
    systemPrompt: `You are the Fixer - error resolution specialist.

## Your Job
Fix the SPECIFIC errors reported by reviewer.

## Input Format
You receive error reports like:
\`\`\`
[ERROR-001] <category>
\u251C\u2500\u2500 File: <path>
\u251C\u2500\u2500 Line: <number>
\u251C\u2500\u2500 Issue: <problem>
\u251C\u2500\u2500 Found: \`<bad code>\`
\u251C\u2500\u2500 Expected: \`<good code>\`
\u251C\u2500\u2500 Fix: <instruction>
\`\`\`

## Fixing Process
1. ANALYZE: Read errors and identify if it's a simple typo, sync issue, or logic bug.
2. SUMMARIZE: Briefly state what went wrong (e.g., "Export name mismatch in api.ts").
3. FIX: Apply minimal fix to address the root cause.
4. VERIFY: Ensure fix doesn't create new issues.

## Rules
- Fix ALL reported errors
- Make MINIMAL changes
- Don't "improve" unrelated code
- Check for name mismatches (case sensitivity)
- Keep existing style
- **ANTI-OVERENGINEERING**:
  - If Syntax/Indent error: ONLY fix the character/spacing. NO logic changes.
  - If Typo: ONLY fix the name.

## Output Format
\`\`\`
### Analysis
- [ERROR-001]: <cause> (e.g., Missing closing brace at line 42)

### Fixes Applied
\`\`\`<language>
// Fixed code
\`\`\`

## If Fix Unclear
- Ask for clarification
- Show what you understand
- Propose alternative fix`,
    canWrite: true,
    canBash: true
  },
  // ═══════════════════════════════════════════════════════════════
  // SEARCHER - Context Provider
  // ═══════════════════════════════════════════════════════════════
  searcher: {
    id: "searcher",
    description: "Context provider - finds documentation and codebase patterns",
    systemPrompt: `You are the Searcher - the context oracle.

## Mission
Your primary job is to find the **Truth** in the codebase.
In 'Context First' mode, you MUST prioritize reading all .md documentation files.

## What to Find
1. **Boundaries**: Read README.md, ARCHITECTURE.md to understand what NOT to do.
2. **Patterns**: Find existing code that solves similar problems.
3. **Types & Interfaces**: Identify the data structures to follow.
4. **Project Style**: Detect naming and formatting conventions.

## SOP
1. Start with \`find_by_name\` for *.md files.
2. Use \`grep_search\` for specific logic patterns.
3. **Value Judgment**: Before reporting, ask "Is this relevant to the CURRENT task step?".
4. **Context Sharding**: If findings are huge, WRITE them to \`temp_context_findings.md\` and only report the path.
5. **Recursive Summarization**: If reading an existing context file, condense it further based on current progress.

## Output Format
Produce a clear summary or a file pointer:
"\u26A0\uFE0F Large context detected. Written to \`temp_context_auth_logic.md\`."
OR
### 1. Architectural Boundaries (from docs)
### 2. Relevant Patterns (code snippets)
### 3. Recommendations`,
    canWrite: false,
    canBash: false
  }
};
function getBinaryPath() {
  const binDir = join(__dirname, "..", "bin");
  const os = platform();
  const cpu = arch();
  let binaryName;
  if (os === "win32") {
    binaryName = "orchestrator-windows-x64.exe";
  } else if (os === "darwin") {
    binaryName = cpu === "arm64" ? "orchestrator-macos-arm64" : "orchestrator-macos-x64";
  } else {
    binaryName = cpu === "arm64" ? "orchestrator-linux-arm64" : "orchestrator-linux-x64";
  }
  let binaryPath = join(binDir, binaryName);
  if (!existsSync(binaryPath)) {
    binaryPath = join(binDir, os === "win32" ? "orchestrator.exe" : "orchestrator");
  }
  return binaryPath;
}
async function callRustTool(name, args) {
  const binary = getBinaryPath();
  if (!existsSync(binary)) {
    return JSON.stringify({ error: `Binary not found: ${binary}` });
  }
  return new Promise((resolve) => {
    const proc = spawn(binary, ["serve"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    const request = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args }
    });
    proc.stdin.write(request + "\n");
    proc.stdin.end();
    const timeout = setTimeout(() => {
      proc.kill();
      resolve(JSON.stringify({ error: "Timeout" }));
    }, 6e4);
    proc.on("close", () => {
      clearTimeout(timeout);
      try {
        const lines = stdout.trim().split("\n");
        const response = JSON.parse(lines[lines.length - 1]);
        const text = response?.result?.content?.[0]?.text;
        resolve(text || JSON.stringify(response.result));
      } catch {
        resolve(stdout || "No output");
      }
    });
  });
}
var state = {
  missionActive: false,
  maxIterations: 1e3,
  // Effectively infinite - "Relentless" mode
  maxRetries: 3,
  sessions: /* @__PURE__ */ new Map()
};
var callAgentTool = tool({
  description: `Call a team member to perform specific work.

## Team
- **planner**: Decompose complex task into atomic units
- **coder**: Implement single atomic task
- **reviewer**: Quality check (ALWAYS after coder)
- **fixer**: Fix specific errors from reviewer
- **searcher**: Find patterns and context

## Self-Correcting Workflow
1. planner \u2192 atomic tasks
2. For each task:
   - searcher (if needed)
   - coder
   - reviewer (mandatory)
   - fixer (if errors) \u2192 reviewer again
3. Continue until all pass`,
  args: {
    agent: tool.schema.enum(["planner", "coder", "reviewer", "fixer", "searcher"]).describe("Team member to call"),
    task: tool.schema.string().describe("Atomic task or specific error to address"),
    context: tool.schema.string().optional().describe("Relevant context from previous steps")
  },
  async execute(args) {
    const agentDef = AGENTS[args.agent];
    if (!agentDef) {
      return `Error: Unknown agent: ${args.agent}`;
    }
    const taskIdMatch = args.task.match(/\[(TASK-\d+)\]/i);
    if (taskIdMatch) {
    }
    const prompt = `
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
${agentDef.id.toUpperCase()} AGENT
${agentDef.description}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

<system>
${agentDef.systemPrompt}
</system>

<task>
${args.task}
</task>

${args.context ? `<context>
${args.context}
</context>` : ""}

Execute according to your role. Be thorough and precise.
`;
    return prompt;
  }
});
var COMMANDS = {
  "task": {
    description: "Execute a mission using Distributed Cognitive Architecture (PDCA Cycle)",
    template: `\u{1F680} MISSION: DISTRIBUTED TASK EXECUTION (PDCA Methodology)
<command-instruction>
You are the **Kernel** of this operation. You employ **Dynamic Programming** and **Divide & Conquer**.

## Phase 0: Cost/Benefit & Complexity Analysis
- **Assess**: Is this a quick "hotfix" (Linear) or a "System Overhaul" (Distributed Task)?
- **Allocating Strategy**: If complex, activate the **Swarm**.

## Phase 1: Deep Analysis & State Initialization (Plan)
- BEFORE planning, call **searcher** to read all .md docs.
- Create a temporary \`.opencode_mission.md\` as your **Shared Memory Segment**.
- **State Strategy**: Define how independent nodes will share data (e.g., File I/O, config files).

## Phase 1.5: Sync Contract Deal (Interface Agreement)
- **CRITICAL**: If parallel tasks interact (e.g., A calls B), you MUST define the **Interface Contract** first.
- Create \`_interface_contract.md\` containing:
  - Exact Function Signatures & Types.
  - API Routes & Parameter Structures.
  - File Paths for shared data.
- All Agents MUST read this contract before writing code.

## Phase 2: Hierarchical Planning (Do - Step 1)
- Call **planner** to Map the mission into atomic tasks ($O(1)$ complexity).
- **Divide & Conquer**: Break down the problem recursively.
- **Resource Binding**: Bind specific agents/tools to tasks.

## Phase 3: Parallel Execution & Verification (Do - Step 2 & Check)
- Execute READY tasks in parallel. Each agent acts as an independent Actor.
- **PDCA Cycle**: Plan -> Do (Code) -> Check (Review) -> Act (Fix/Merge).
- Route implementation to the **reviewer** (Byzantine Fault Tolerance check).

## Phase 4: Global Sync Gate (Act)
- Once all tasks are \u2705 Completed, call **reviewer** for a **Global Consistency Check**.
- verify imports, exports, and cross-file logic patterns.
- DELETE \`.opencode_mission.md\` after final SUCCESS.

## Goal
Achieve **Architectural Superiority**. Complete "$ARGUMENTS" with ZERO regressions.
We do NOT stop for time. We stop when it is DONE.
</command-instruction>

<user-task>
$ARGUMENTS
</user-task>`,
    argumentHint: '"mission goal"'
  },
  "plan": {
    description: "Decompose task into atomic units",
    template: `<agent-prompt agent="planner">
Decompose into atomic tasks:
$ARGUMENTS
</agent-prompt>`,
    argumentHint: '"complex task"'
  },
  "review": {
    description: "Quality check with error detection",
    template: `<agent-prompt agent="reviewer">
Review for ALL issues:
$ARGUMENTS
</agent-prompt>`,
    argumentHint: '"code to review"'
  },
  "fix": {
    description: "Fix specific errors",
    template: `<agent-prompt agent="fixer">
Fix these errors:
$ARGUMENTS
</agent-prompt>`,
    argumentHint: '"error details"'
  },
  "search": {
    description: "Find patterns and context",
    template: `<agent-prompt agent="searcher">
Find patterns for:
$ARGUMENTS
</agent-prompt>`,
    argumentHint: '"what to find"'
  },
  "agents": {
    description: "Show agent team",
    template: `## 6-Agent Collaborative Architecture

| Agent | Role |
|-------|------|
| planner | Decompose into atomic tasks |
| coder | Implement single task |
| reviewer | Quality gate (mandatory) |
| fixer | Apply specific fixes |
| searcher | Find context |

## Self-Correcting Loop
\`\`\`
plan \u2192 (search \u2192 code \u2192 review \u2192 fix?) \u2192 repeat
\`\`\``
  },
  "cancel-auto": {
    description: "Stop auto mode",
    template: `Auto mode stopped.`
  }
};
function createSlashcommandTool() {
  const commandList = Object.entries(COMMANDS).map(([name, cmd]) => {
    const hint = cmd.argumentHint ? ` ${cmd.argumentHint}` : "";
    return `- /${name}${hint}: ${cmd.description}`;
  }).join("\n");
  return tool({
    description: `Commands

${commandList}`,
    args: {
      command: tool.schema.string().describe("Command (without slash)")
    },
    async execute(args) {
      const cmdName = (args.command || "").replace(/^\//, "").split(/\s+/)[0].toLowerCase();
      const cmdArgs = (args.command || "").replace(/^\/?\\S+\s*/, "");
      if (!cmdName) return `Commands:
${commandList}`;
      const command = COMMANDS[cmdName];
      if (!command) return `Unknown: /${cmdName}

${commandList}`;
      return command.template.replace(/\$ARGUMENTS/g, cmdArgs || "continue");
    }
  });
}
var grepSearchTool = (directory) => tool({
  description: "Search code patterns",
  args: {
    pattern: tool.schema.string().describe("Regex pattern"),
    dir: tool.schema.string().optional().describe("Directory")
  },
  async execute(args) {
    return callRustTool("grep_search", {
      pattern: args.pattern,
      directory: args.dir || directory
    });
  }
});
var globSearchTool = (directory) => tool({
  description: "Find files by pattern",
  args: {
    pattern: tool.schema.string().describe("Glob pattern"),
    dir: tool.schema.string().optional().describe("Directory")
  },
  async execute(args) {
    return callRustTool("glob_search", {
      pattern: args.pattern,
      directory: args.dir || directory
    });
  }
});
function detectSlashCommand(text) {
  const match = text.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
  if (!match) return null;
  return { command: match[1], args: match[2] || "" };
}
var OrchestratorPlugin = async (input) => {
  const { directory } = input;
  return {
    tool: {
      call_agent: callAgentTool,
      slashcommand: createSlashcommandTool(),
      grep_search: grepSearchTool(directory),
      glob_search: globSearchTool(directory)
    },
    // Register commands and agents so they appear in OpenCode's UI
    config: async (config) => {
      const existingCommands = config.command ?? {};
      const existingAgents = config.agent ?? {};
      const orchestratorCommands = {};
      for (const [name, cmd] of Object.entries(COMMANDS)) {
        orchestratorCommands[name] = {
          description: cmd.description,
          template: cmd.template,
          argumentHint: cmd.argumentHint
        };
      }
      const orchestratorAgents = {
        Orchestrator: {
          name: "Orchestrator",
          description: "Mission Commander - 6-agent collaborative AI for complex tasks",
          systemPrompt: AGENTS.orchestrator.systemPrompt
        }
      };
      config.command = {
        ...orchestratorCommands,
        ...existingCommands
      };
      config.agent = {
        ...orchestratorAgents,
        ...existingAgents
      };
    },
    "chat.message": async (input2, output) => {
      const parts = output.parts;
      const textPartIndex = parts.findIndex((p) => p.type === "text" && p.text);
      if (textPartIndex === -1) return;
      const originalText = parts[textPartIndex].text || "";
      const parsed = detectSlashCommand(originalText);
      if (parsed) {
        const command = COMMANDS[parsed.command];
        if (command) {
          parts[textPartIndex].text = command.template.replace(/\$ARGUMENTS/g, parsed.args || "continue");
          if (parsed.command === "task" || parsed.command === "flow" || parsed.command === "dag" || parsed.command === "auto" || parsed.command === "ignite") {
            const sessionID = input2.sessionID;
            state.sessions.set(sessionID, {
              enabled: true,
              iterations: 0,
              taskRetries: /* @__PURE__ */ new Map(),
              currentTask: ""
            });
            state.missionActive = true;
          } else if (parsed.command === "stop" || parsed.command === "cancel") {
            state.sessions.delete(input2.sessionID);
            state.missionActive = false;
          }
        }
      }
    },
    "tool.execute.after": async (input2, output) => {
      if (!state.missionActive) return;
      const session = state.sessions.get(input2.sessionID);
      if (!session?.enabled) return;
      session.iterations++;
      if (input2.tool === "call_agent" && input2.arguments?.task) {
        const taskIdMatch = input2.arguments.task.match(/\[(TASK-\d+)\]/i);
        if (taskIdMatch) {
          session.currentTask = taskIdMatch[1].toUpperCase();
          session.graph?.updateTask(session.currentTask, { status: "running" });
        }
      }
      if (session.iterations >= state.maxIterations) {
        session.enabled = false;
        output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u26A0\uFE0F ITERATION LIMIT (${state.maxIterations})
Review progress and continue manually.`;
        return;
      }
      if (output.output.includes("[") && output.output.includes("]") && output.output.includes("{") && input2.tool === "call_agent") {
        const jsonMatch = output.output.match(/```json\n([\s\S]*?)\n```/) || output.output.match(/\[\s+\{[\s\S]*?\}\s+\]/);
        if (jsonMatch) {
          try {
            const tasks = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            if (Array.isArray(tasks) && tasks.length > 0) {
              session.graph = new TaskGraph(tasks);
              output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2705 MISSION INITIALIZED
${session.graph.getTaskSummary()}`;
            }
          } catch (e) {
          }
        }
      }
      if (session.graph) {
        if (output.output.includes("\u2705 PASS")) {
          const taskId = session.currentTask;
          if (taskId) {
            session.graph.updateTask(taskId, { status: "completed" });
            session.taskRetries.clear();
            output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2705 TASK ${taskId} VERIFIED
${session.graph.getTaskSummary()}`;
          }
        } else if (output.output.includes("\u274C FAIL")) {
          const taskId = session.currentTask;
          if (taskId) {
            const errorId = `error-${taskId}`;
            const retries = (session.taskRetries.get(errorId) || 0) + 1;
            session.taskRetries.set(errorId, retries);
            if (retries >= state.maxRetries) {
              session.graph.updateTask(taskId, { status: "failed" });
              output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u26A0\uFE0F TASK ${taskId} FAILED (Retry Limit)
PIVOT REQUIRED: Re-plan or seek context.`;
            } else {
              output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F504} RETRY ${retries}/${state.maxRetries} for ${taskId}`;
            }
          }
        }
      } else {
        const errorMatch = output.output.match(/\[ERROR-(\d+)\]/);
        if (errorMatch) {
          const errorId = `error-${session.currentTask || "unknown"}`;
          const retries = (session.taskRetries.get(errorId) || 0) + 1;
          session.taskRetries.set(errorId, retries);
          if (retries >= state.maxRetries) {
            output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u26A0\uFE0F RETRY LIMIT (${state.maxRetries}x)
PIVOT REQUIRED.`;
            return;
          }
          output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F504} RETRY ${retries}/${state.maxRetries}`;
          return;
        }
        if (output.output.includes("\u2705 PASS")) {
          session.taskRetries.clear();
          output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2705 VERIFIED`;
          return;
        }
      }
      if (session.graph) {
        const readyTasks = session.graph.getReadyTasks();
        const guidance = readyTasks.length > 0 ? `
\u{1F449} **READY TO EXECUTE**: ${readyTasks.map((t) => `[${t.id}]`).join(", ")}` : `
\u26A0\uFE0F NO READY TASKS. Check dependencies or completion.`;
        output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
${session.graph.getTaskSummary()}${guidance}`;
      }
      output.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
[DAG STEP: ${session.iterations}/${state.maxIterations}]`;
    }
  };
};
var index_default = OrchestratorPlugin;
export {
  index_default as default
};
