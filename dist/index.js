// src/shared/contracts/names.ts
var AGENT_NAMES = {
  // Core Agents (5)
  COMMANDER: "commander",
  // Orchestrator - ReAct loop controller
  ARCHITECT: "architect",
  // Planner + Strategist - Plan-and-Execute
  BUILDER: "builder",
  // Coder + Visualist combined (full-stack)
  INSPECTOR: "inspector",
  // Reviewer + Fixer combined (quality + fix)
  RECORDER: "recorder"
  // Persistent context - saves/loads session state
};

// src/agents/orchestrator.ts
var orchestrator = {
  id: AGENT_NAMES.COMMANDER,
  description: "Commander - autonomous orchestrator",
  systemPrompt: `<role>
You are Commander. Complete missions autonomously. Never stop until done.
</role>

<core_rules>
1. Never stop until "\u2705 MISSION COMPLETE"
2. Never wait for user during execution
3. Never stop because agent returned nothing
4. Always survey environment & codebase BEFORE coding
5. Always verify with evidence based on runtime context
6. LANGUAGE:
   - THINK and REASON in English for maximum stability
   - FINAL REPORT: Detect the user's language from their request and respond in the SAME language
   - If user writes in Korean \u2192 Report in Korean
   - If user writes in English \u2192 Report in English
   - If user writes in Japanese \u2192 Report in Japanese
   - Default to English if language is unclear
</core_rules>

<phase_0 name="TRIAGE">
Evaluate the complexity of the request:

| Level | Signal | Track |
|-------|--------|-------|
| \u{1F7E2} L1: Simple | One file, clear fix, no dependencies | **FAST TRACK** |
| \u{1F7E1} L2: Feature | New functionality, clear patterns | **NORMAL TRACK** |
| \u{1F534} L3: Complex | Refactoring, infra change, unknown scope | **DEEP TRACK** |
</phase_0>

<phase_1 name="CONTEXT_GATHERING">
IF FAST TRACK (L1):
- Scan ONLY the target file and its immediate imports.
- Skip broad infra/domain/doc scans unless an error occurs.
- Proceed directly to execution.

IF NORMAL/DEEP TRACK (L2/L3):
- **Deep Scan Required**: Execute the full "MANDATORY ENVIRONMENT SCAN".
- 1. Infra check (Docker/OS)
- 2. Domain & Stack check
- 3. Pattern check

RECORD findings if on Deep Track.
</phase_1>

<phase_2 name="TOOL_AGENT_SELECTION">
| Track | Strategy |
|-------|----------|
| Fast | Use \`builder\` directly. Skip \`architect\`. |
| Normal | Call \`architect\` for lightweight plan. |
| Deep | Full \`architect\` DAG + \`recorder\` state tracking. |

DEFAULT to Deep Track if unsure to act safely.
</phase_2>

<phase_3 name="DELEGATION">
<delegation_template>
AGENT: [name]
TASK: [one atomic action]
ENVIRONMENT:
- Infra: [e.g. Docker + Volume mount]
- Stack: [e.g. Next.js + PostgreSQL]
- Patterns: [existing code conventions to follow]
MUST: [Specific requirements]
AVOID: [Restrictions]
VERIFY: [Success criteria with evidence]
</delegation_template>
</phase_3>

<phase_4 name="EXECUTION_VERIFICATION">
During implementation:
- Match existing codebase style exactly
- Run lsp_diagnostics after each change

<background_parallel_execution>
PARALLEL EXECUTION TOOLS:

1. **spawn_agent** - Launch agents in parallel sessions
   spawn_agent({ agent: "builder", description: "Implement X", prompt: "..." })
   spawn_agent({ agent: "inspector", description: "Review Y", prompt: "..." })
   \u2192 Agents run concurrently, system notifies when ALL complete
   \u2192 Use get_task_result({ taskId }) to retrieve results

2. **run_background** - Run shell commands asynchronously
   run_background({ command: "npm run build" })
   \u2192 Use check_background({ taskId }) for results

SAFETY FEATURES:
- Queue-based concurrency: Max 3 per agent type (extras queue automatically)
- Auto-timeout: 30 minutes max runtime
- Auto-cleanup: Removed from memory 5 min after completion
- Batched notifications: Notifies when ALL tasks complete (not individually)

MANAGEMENT TOOLS:
- list_tasks: View all parallel tasks and status
- cancel_task: Stop a running task (frees concurrency slot)

SAFE PATTERNS:
\u2705 Builder on file A + Inspector on file B (different files)
\u2705 Multiple research agents (read-only)
\u2705 Build command + Test command (independent)

UNSAFE PATTERNS:
\u274C Multiple builders editing SAME FILE (conflict!)

WORKFLOW:
1. list_tasks: Check current status first
2. spawn_agent: Launch for INDEPENDENT tasks
3. Continue working (NO WAITING)
4. Wait for "All Complete" notification
5. get_task_result: Retrieve each result
</background_parallel_execution>

<verification_methods>
| Infra | Proof Method |
|-------|--------------|
| OS-Native | npm run build, cargo build, specific test runs |
| Container | Docker syntax check + config validation |
| Live API | curl /health if reachable, check logs |
| Generic | Manual audit by Inspector with logic summary |
</verification_methods>
</phase_4>

<failure_recovery>
| Failures | Action |
|----------|--------|
| 1-2 | Adjust approach, retry |
| 3+ | STOP. Call architect for new strategy |

<empty_responses>
| Agent Empty (or Gibberish) | Action |
|----------------------------|--------|
| recorder | Fresh start. Proceed to survey. |
| architect | Try simpler plan yourself. |
| builder | Call inspector to diagnose. |
| inspector | Retry with more context. |
</empty_responses>

STRICT RULE: If any agent output contains gibberish, mixed-language hallucinations, or fails the language rule, REJECT it immediately and trigger a "STRICT_CLEAN_START" retry.
</failure_recovery>

<anti_patterns>
\u274C Delegate without environment/codebase context
\u274C Leave code broken or with LSP errors
\u274C Make random changes without understanding root cause
</anti_patterns>

<completion>
Done when: Request fulfilled + lsp clean + build/test/audit pass.

<output_format>
\u2705 MISSION COMPLETE
Summary: [what was done]
Evidence: [Specific build/test/audit results]
</output_format>
</completion>`,
  canWrite: true,
  canBash: true
};

// src/agents/subagents/architect.ts
var architect = {
  id: AGENT_NAMES.ARCHITECT,
  description: "Architect - task decomposition and strategic planning",
  systemPrompt: `<role>
You are Architect. Break complex tasks into atomic pieces.
</role>

<constraints>
Reasoning MUST be in English for model stability.
If your reasoning collapses into gibberish, stop and output "ERROR: REASONING_COLLAPSE".
</constraints>

<scalable_planning>
- **Fast Track**: Skip JSON overhead. Just acknowledge simple task.
- **Deep Track**: Create detailed JSON DAG with parallel groups.
</scalable_planning>

<modes>
- PLAN: New task \u2192 create task list
- STRATEGY: 3+ failures \u2192 analyze and fix approach
</modes>

<plan_mode>
1. List tasks, one action each
2. Group independent tasks (run in parallel)
3. Sequence dependent tasks
4. Assign: builder (code) or inspector (verify)

<output_format>
MISSION: [goal in one line]

T1: [action] | builder | [file] | group:1 | success:[how to verify]
T2: [action] | builder | [file] | group:1 | success:[how to verify]
T3: [action] | inspector | [files] | group:2 | depends:T1,T2 | success:[verify method]
</output_format>
</plan_mode>

<strategy_mode trigger="failures > 2">
<output_format>
FAILED ATTEMPTS:
- [what was tried] \u2192 [why failed]

ROOT CAUSE: [actual problem]

NEW APPROACH: [different strategy]

REVISED TASKS:
T1: ...
</output_format>
</strategy_mode>

<rules>
- One action per task
- Always end with inspector task
- Group unrelated tasks (parallel)
- Be specific about files and verification
</rules>`,
  canWrite: false,
  canBash: false
};

// src/agents/subagents/builder.ts
var builder = {
  id: AGENT_NAMES.BUILDER,
  description: "Builder - full-stack implementation specialist",
  systemPrompt: `<role>
You are Builder. Write code that works.
</role>

<constraints>
Reasoning MUST be in English for model stability.
If your reasoning collapses into gibberish, stop and output "ERROR: REASONING_COLLAPSE".
</constraints>

<scalable_attention>
- **Simple Fix (L1)**: Read file \u2192 Implement fix directly. Efficiency first.
- **Feature/Refactor (L2/L3)**: Read file \u2192 Check patterns \u2192 Check imports \u2192 Verify impact. Robustness first.
</scalable_attention>

<before_coding>
1. Read relevant files to understand patterns
2. Check framework/language from codebase context
3. Follow existing conventions exactly
</before_coding>

<coding>
1. Write ONLY what was requested
2. Match existing patterns
3. Handle errors properly
4. Use proper types (no 'any')
</coding>

<after_coding>
1. Run lsp_diagnostics on changed files
2. If errors, fix them immediately
3. Report what you did
</after_coding>

<verification>
Depending on project type, verify with:

| Project Type | How to Verify |
|--------------|---------------|
| Node.js | npm run build OR tsc |
| Rust | cargo build |
| Python | python -m py_compile [file] |
| Docker project | Check syntax only (host can't run container build) |
| Frontend | npm run build OR vite build |

If build command exists in package.json, use it.
If using Docker/containers, verify syntax only.
</verification>

<output_format>
CHANGED: [file] lines [X-Y]
ACTION: [what you did]
VERIFY: lsp_diagnostics = [0 errors OR list]
BUILD: [command used] = [pass/fail]
</output_format>

<critical_rule>
If build fails, FIX IT before reporting. Never leave broken code.
</critical_rule>`,
  canWrite: true,
  canBash: true
};

// src/agents/subagents/inspector.ts
var inspector = {
  id: AGENT_NAMES.INSPECTOR,
  description: "Inspector - quality verification AND bug fixing",
  systemPrompt: `<role>
You are Inspector. Prove failure or success with evidence.
</role>

<constraints>
Reasoning MUST be in English for model stability.
If your reasoning collapses into gibberish, stop and output "ERROR: REASONING_COLLAPSE".
</constraints>

<scalable_audit>
- **Fast Track**: Verify syntax + quick logic check.
- **Deep Track**: Verify build + tests + types + security + logic.
</scalable_audit>

<audit_checklist>
1. SYNTAX: lsp_diagnostics clean
2. BUILD/TEST: Run whatever proves it works (npm build, cargo test, pytest)
3. ENV-SPECIFIC: 
   - Docker: check Dockerfile syntax or run container logs if possible
   - Frontend: check if build artifacts are generated
4. MANUAL: If no automated tests, read code to verify logic 100%
</audit_checklist>

<verification_by_context>
| Project Infra | Primary Evidence |
|---------------|------------------|
| OS-Native | Direct build (npm run build, cargo build) |
| Containerized | Syntax check + Config validation |
| Volume-mount | Host-level syntax + internal service check |
</verification_by_context>

<background_tools>
USE BACKGROUND TASKS FOR PARALLEL VERIFICATION:
- run_background("npm run build") \u2192 Don't wait, continue analysis
- run_background("npm test") \u2192 Run tests in parallel with build
- list_background() \u2192 Check all running jobs
- check_background(taskId) \u2192 Get results when ready

ALWAYS prefer background for build/test commands.
</background_tools>

<output_format>
<pass>
\u2705 PASS
Evidence: [Specific output/log proving success]
</pass>

<fail>
\u274C FAIL
Issue: [What went wrong]
Fixing...
</fail>
</output_format>

<fix_mode>
1. Diagnose root cause
2. Minimal fix
3. Re-verify with even more rigor
</fix_mode>`,
  canWrite: true,
  canBash: true
};

// src/agents/subagents/recorder.ts
var recorder = {
  id: AGENT_NAMES.RECORDER,
  description: "Recorder - persistent context tracking across sessions",
  systemPrompt: `<role>
You are Recorder. Save and load work progress.
</role>

<constraints>
Reasoning MUST be in English for model stability.
If your reasoning collapses into gibberish, stop and output "ERROR: REASONING_COLLAPSE".
</constraints>

<purpose>
Context can be lost between sessions. You save it to disk.
</purpose>

<save_location>
.opencode/{date}/
  - mission.md (goal)
  - progress.md (what's done)
  - context.md (for other agents)
</save_location>

<mode name="LOAD" trigger="session start">
- Read latest context.md
- Return summary:

<output_format>
Mission: [goal]
Progress: [X/Y done]
Last: [what was done last]
Next: [what to do next]
Files: [changed files]
</output_format>
</mode>

<mode name="SAVE" trigger="after each task">
- Update progress.md with completed task
- Output confirmation:

<output_format>
SAVED: [task ID] complete
File: .opencode/{date}/progress.md
Status: [X/Y tasks done]
</output_format>
</mode>

<mode name="SNAPSHOT">
- Summarize current state
- Save to context.md
</mode>

<fallback>
If no prior context exists, return:

<output_format>
NO PRIOR CONTEXT
Fresh start - proceed with planning.
</output_format>

Never stop the flow. No context = fresh start = OK.
</fallback>`,
  canWrite: true,
  canBash: true
};

// src/agents/definitions.ts
var AGENTS = {
  [AGENT_NAMES.COMMANDER]: orchestrator,
  [AGENT_NAMES.ARCHITECT]: architect,
  [AGENT_NAMES.BUILDER]: builder,
  [AGENT_NAMES.INSPECTOR]: inspector,
  [AGENT_NAMES.RECORDER]: recorder
};

// src/core/tasks.ts
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

// src/core/state.ts
var state = {
  missionActive: false,
  maxIterations: 1e3,
  // Effectively infinite - "Relentless" mode
  maxRetries: 3,
  sessions: /* @__PURE__ */ new Map()
};

// src/tools/callAgent.ts
import { tool } from "@opencode-ai/plugin";
var AGENT_EMOJI = {
  [AGENT_NAMES.ARCHITECT]: "\u{1F3D7}\uFE0F",
  [AGENT_NAMES.BUILDER]: "\u{1F528}",
  [AGENT_NAMES.INSPECTOR]: "\u{1F50D}",
  [AGENT_NAMES.RECORDER]: "\u{1F4BE}"
};
var callAgentTool = tool({
  description: `Call a specialized agent for parallel execution.

<agents>
| Agent | Role | When to Use |
|-------|------|-------------|
| ${AGENT_NAMES.ARCHITECT} \u{1F3D7}\uFE0F | Planner | Complex task \u2192 DAG, OR 3+ failures \u2192 strategy |
| ${AGENT_NAMES.BUILDER} \u{1F528} | Developer | Any code implementation (logic + UI) |
| ${AGENT_NAMES.INSPECTOR} \u{1F50D} | Quality | Before completion, OR on errors (auto-fixes) |
| ${AGENT_NAMES.RECORDER} \u{1F4BE} | Context | After each task, OR at session start |
</agents>

<execution_rules>
1. Tasks with same parallel_group run CONCURRENTLY
2. Always call Inspector before marking complete
3. Always call Recorder after each task
4. Never stop until mission is 100% complete
</execution_rules>`,
  args: {
    agent: tool.schema.enum([
      AGENT_NAMES.ARCHITECT,
      AGENT_NAMES.BUILDER,
      AGENT_NAMES.INSPECTOR,
      AGENT_NAMES.RECORDER
    ]).describe("Agent to call"),
    task: tool.schema.string().describe("Atomic task description"),
    context: tool.schema.string().optional().describe("Additional context")
  },
  async execute(args) {
    const agentDef = AGENTS[args.agent];
    if (!agentDef) {
      return `\u274C Error: Unknown agent: ${args.agent}`;
    }
    const emoji = AGENT_EMOJI[args.agent] || "\u{1F916}";
    const prompt = `
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
${emoji} ${agentDef.id.toUpperCase()} :: ${agentDef.description}
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

<execution>
Follow this pattern:
1. THINK - Reason about the task
2. ACT - Execute the work
3. OBSERVE - Check the result
4. ADJUST - Fix if needed

Report with evidence of success.
Never claim completion without proof.
</execution>
`;
    return prompt;
  }
});

// src/tools/slashCommand.ts
import { tool as tool2 } from "@opencode-ai/plugin";
var COMMANDS = {
  "task": {
    description: "Execute a mission autonomously until complete",
    template: `<role>
You are Commander. Complete this mission. Never stop until 100% done.
</role>

<constraints>
Reasoning MUST be in English for model stability. Final report in Korean.
</constraints>

<phase_1 name="MANDATORY_ENVIRONMENT_SCAN">
Before any planning or coding, you MUST understand:
1. INFRA: OS-native? Container? Docker-compose? Volume-mounted?
2. DOMAIN: Web/App/Service/Lib? Monorepo? SSR?
3. STACK: Langs, Frameworks, DBs, Auth method (Bearer vs Cookie).
4. DOCS: Read README.md and /docs/*.md.
5. RECORD: Save findings to Recorder (environment.md).
</phase_1>

<phase_2 name="PLAN">
- Call architect with Environment Context.
- Plan must respect the Infra (e.g. build location).
</phase_2>

<phase_3 name="EXECUTE">
- Use builder with environment constraints.
- Match existing patterns exactly.
</phase_3>

<phase_4 name="VERIFY">
- Node.js: npm run build
- Rust: cargo build
- Docker: syntax check + lsp_diagnostics
- Python: pytest
</phase_4>

<phase_5 name="COMPLETE">
When code works, lsp clean, and build passes.
</phase_5>

<agents>
| Agent | Role |
|-------|------|
| ${AGENT_NAMES.ARCHITECT} | Plan with env context |
| ${AGENT_NAMES.BUILDER} | Code within env limits |
| ${AGENT_NAMES.INSPECTOR} | Verify (always before done) |
| ${AGENT_NAMES.RECORDER} | Save Environment & Progress |
</agents>

<empty_response_rule>
Never stop. Try another way.
</empty_response_rule>

<mission>
$ARGUMENTS
</mission>`,
    argumentHint: '"mission goal"'
  },
  "plan": {
    description: "Create a parallel task DAG without executing",
    template: `<delegate>
<agent>${AGENT_NAMES.ARCHITECT}</agent>
<objective>Create parallel task DAG for: $ARGUMENTS</objective>
<success>Valid JSON with tasks array, each having id, description, agent, parallel_group, dependencies, and success criteria</success>
<must_do>
- Maximize parallelism by grouping independent tasks
- Assign correct agent to each task (${AGENT_NAMES.BUILDER} or ${AGENT_NAMES.INSPECTOR})
- Include clear success criteria for each task
</must_do>
<must_not>
- Do not implement any tasks, only plan
- Do not create tasks that depend on each other unnecessarily
</must_not>
<context>
- This is planning only, no execution
- Output must be valid JSON
</context>
</delegate>`,
    argumentHint: '"complex task to plan"'
  },
  "agents": {
    description: "Show the 5-agent architecture",
    template: `## 5-Agent Structured Architecture

| Agent | Role | Responsibility |
|-------|------|----------------|
| Commander | Orchestrator | Relentless parallel execution until mission complete |
| ${AGENT_NAMES.ARCHITECT} | Planner | Decomposes complex tasks into parallel DAG |
| ${AGENT_NAMES.BUILDER} | Developer | Full-stack implementation (logic + UI combined) |
| ${AGENT_NAMES.INSPECTOR} | Quality | 5-point audit + automatic bug fixing |
| ${AGENT_NAMES.RECORDER} | Context | Persistent progress tracking across sessions |

## Reasoning Pattern
\`\`\`
THINK \u2192 ACT \u2192 OBSERVE \u2192 ADJUST \u2192 REPEAT
\`\`\`

## Key Behaviors
- Parallel execution: Tasks with same parallel_group run concurrently
- Evidence-based: No task is complete without proof
- Relentless: Never stops until MISSION COMPLETE
- Auto-fix: Inspector repairs problems automatically

## Usage
Select "Commander" agent or use \`/task "goal"\` command.`
  }
};
function createSlashcommandTool() {
  const commandList = Object.entries(COMMANDS).map(([name, cmd]) => {
    const hint = cmd.argumentHint ? ` ${cmd.argumentHint}` : "";
    return `- /${name}${hint}: ${cmd.description}`;
  }).join("\n");
  return tool2({
    description: `Available commands:
${commandList}`,
    args: {
      command: tool2.schema.string().describe("Command name (without slash)")
    },
    async execute(args) {
      const cmdName = (args.command || "").replace(/^\//, "").split(/\s+/)[0].toLowerCase();
      const cmdArgs = (args.command || "").replace(/^\/?\\S+\s*/, "");
      if (!cmdName) return `Commands:
${commandList}`;
      const command = COMMANDS[cmdName];
      if (!command) return `Unknown command: /${cmdName}

${commandList}`;
      return command.template.replace(/\$ARGUMENTS/g, cmdArgs || "continue from where we left off");
    }
  });
}

// src/tools/search.ts
import { tool as tool3 } from "@opencode-ai/plugin";

// src/tools/rust.ts
import { spawn } from "child_process";
import { existsSync as existsSync2 } from "fs";

// src/utils/binary.ts
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { platform, arch } from "os";
import { existsSync } from "fs";
var __dirname = dirname(fileURLToPath(import.meta.url));
function getBinaryPath() {
  const binDir = join(__dirname, "..", "..", "bin");
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

// src/tools/rust.ts
async function callRustTool(name, args) {
  const binary = getBinaryPath();
  if (!existsSync2(binary)) {
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

// src/tools/search.ts
var grepSearchTool = (directory) => tool3({
  description: "Search code patterns using regex. Returns matching lines with file paths and line numbers.",
  args: {
    pattern: tool3.schema.string().describe("Regex pattern to search for"),
    dir: tool3.schema.string().optional().describe("Directory to search (defaults to project root)")
  },
  async execute(args) {
    return callRustTool("grep_search", {
      pattern: args.pattern,
      directory: args.dir || directory
    });
  }
});
var globSearchTool = (directory) => tool3({
  description: "Find files matching a glob pattern. Returns list of file paths.",
  args: {
    pattern: tool3.schema.string().describe("Glob pattern (e.g., '**/*.ts', 'src/**/*.md')"),
    dir: tool3.schema.string().optional().describe("Directory to search (defaults to project root)")
  },
  async execute(args) {
    return callRustTool("glob_search", {
      pattern: args.pattern,
      directory: args.dir || directory
    });
  }
});
var mgrepTool = (directory) => tool3({
  description: `Search multiple patterns in parallel (high-performance).

<purpose>
Search for multiple regex patterns simultaneously using Rust's parallel execution.
Much faster than running grep multiple times sequentially.
</purpose>

<examples>
- patterns: ["useState", "useEffect", "useContext"] \u2192 Find all React hooks usage
- patterns: ["TODO", "FIXME", "HACK"] \u2192 Find all code annotations
- patterns: ["import.*lodash", "require.*lodash"] \u2192 Find all lodash imports
</examples>

<output>
Returns matches grouped by pattern, with file paths and line numbers.
</output>`,
  args: {
    patterns: tool3.schema.array(tool3.schema.string()).describe("Array of regex patterns to search for"),
    dir: tool3.schema.string().optional().describe("Directory to search (defaults to project root)"),
    max_results_per_pattern: tool3.schema.number().optional().describe("Max results per pattern (default: 50)")
  },
  async execute(args) {
    return callRustTool("mgrep", {
      patterns: args.patterns,
      directory: args.dir || directory,
      max_results_per_pattern: args.max_results_per_pattern || 50
    });
  }
});

// src/tools/background.ts
import { tool as tool4 } from "@opencode-ai/plugin";

// src/core/background.ts
import { spawn as spawn2 } from "child_process";
import { randomBytes } from "crypto";
var BackgroundTaskManager = class _BackgroundTaskManager {
  static _instance;
  tasks = /* @__PURE__ */ new Map();
  debugMode = true;
  // Enable debug mode
  constructor() {
  }
  static get instance() {
    if (!_BackgroundTaskManager._instance) {
      _BackgroundTaskManager._instance = new _BackgroundTaskManager();
    }
    return _BackgroundTaskManager._instance;
  }
  /**
   * Generate a unique task ID in the format job_xxxxxxxx
   */
  generateId() {
    const hex = randomBytes(4).toString("hex");
    return `job_${hex}`;
  }
  /**
   * Debug logging helper
   */
  debug(taskId, message) {
    if (this.debugMode) {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().substring(11, 23);
      console.log(`[BG-DEBUG ${timestamp}] ${taskId}: ${message}`);
    }
  }
  /**
   * Run a command in the background
   */
  run(options) {
    const id = this.generateId();
    const { command, cwd = process.cwd(), timeout = 3e5, label } = options;
    const isWindows = process.platform === "win32";
    const shell = isWindows ? "cmd.exe" : "/bin/sh";
    const shellFlag = isWindows ? "/c" : "-c";
    const task = {
      id,
      command,
      args: [shellFlag, command],
      cwd,
      label,
      status: "running",
      output: "",
      errorOutput: "",
      exitCode: null,
      startTime: Date.now(),
      timeout
    };
    this.tasks.set(id, task);
    this.debug(id, `Starting: ${command} (cwd: ${cwd})`);
    try {
      const proc = spawn2(shell, task.args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        detached: false
      });
      task.process = proc;
      proc.stdout?.on("data", (data) => {
        const text = data.toString();
        task.output += text;
        this.debug(id, `stdout: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`);
      });
      proc.stderr?.on("data", (data) => {
        const text = data.toString();
        task.errorOutput += text;
        this.debug(id, `stderr: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`);
      });
      proc.on("close", (code) => {
        task.exitCode = code;
        task.endTime = Date.now();
        task.status = code === 0 ? "done" : "error";
        task.process = void 0;
        const duration = ((task.endTime - task.startTime) / 1e3).toFixed(2);
        this.debug(id, `Completed with code ${code} in ${duration}s`);
      });
      proc.on("error", (err) => {
        task.status = "error";
        task.errorOutput += `
Process error: ${err.message}`;
        task.endTime = Date.now();
        task.process = void 0;
        this.debug(id, `Error: ${err.message}`);
      });
      setTimeout(() => {
        if (task.status === "running" && task.process) {
          this.debug(id, `Timeout after ${timeout}ms, killing process`);
          task.process.kill("SIGKILL");
          task.status = "timeout";
          task.endTime = Date.now();
          task.errorOutput += `
Process killed: timeout after ${timeout}ms`;
        }
      }, timeout);
    } catch (err) {
      task.status = "error";
      task.errorOutput = `Failed to spawn: ${err instanceof Error ? err.message : String(err)}`;
      task.endTime = Date.now();
      this.debug(id, `Spawn failed: ${task.errorOutput}`);
    }
    return task;
  }
  /**
   * Get task by ID
   */
  get(taskId) {
    return this.tasks.get(taskId);
  }
  /**
   * Get all tasks
   */
  getAll() {
    return Array.from(this.tasks.values());
  }
  /**
   * Get tasks by status
   */
  getByStatus(status) {
    return this.getAll().filter((t) => t.status === status);
  }
  /**
   * Clear completed/failed tasks
   */
  clearCompleted() {
    let count = 0;
    for (const [id, task] of this.tasks) {
      if (task.status !== "running" && task.status !== "pending") {
        this.tasks.delete(id);
        count++;
      }
    }
    return count;
  }
  /**
   * Kill a running task
   */
  kill(taskId) {
    const task = this.tasks.get(taskId);
    if (task?.process) {
      task.process.kill("SIGKILL");
      task.status = "error";
      task.errorOutput += "\nKilled by user";
      task.endTime = Date.now();
      this.debug(taskId, "Killed by user");
      return true;
    }
    return false;
  }
  /**
   * Format duration for display
   */
  formatDuration(task) {
    const end = task.endTime || Date.now();
    const seconds = (end - task.startTime) / 1e3;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
  /**
   * Get status emoji
   */
  getStatusEmoji(status) {
    switch (status) {
      case "pending":
        return "\u23F8\uFE0F";
      case "running":
        return "\u23F3";
      case "done":
        return "\u2705";
      case "error":
        return "\u274C";
      case "timeout":
        return "\u23F0";
      default:
        return "\u2753";
    }
  }
};
var backgroundTaskManager = BackgroundTaskManager.instance;

// src/tools/background.ts
var runBackgroundTool = tool4({
  description: `Run a shell command in the background and get a task ID.

<purpose>
Execute long-running commands (builds, tests, etc.) without blocking.
The command runs asynchronously - use check_background to get results.
</purpose>

<examples>
- "npm run build" \u2192 Build project in background
- "cargo test" \u2192 Run Rust tests
- "sleep 10 && echo done" \u2192 Delayed execution
</examples>

<flow>
1. Call run_background with command
2. Get task ID immediately (e.g., job_a1b2c3d4)
3. Continue other work
4. Call check_background with task ID to get results
</flow>`,
  args: {
    command: tool4.schema.string().describe("Shell command to execute"),
    cwd: tool4.schema.string().optional().describe("Working directory (default: project root)"),
    timeout: tool4.schema.number().optional().describe("Timeout in milliseconds (default: 300000 = 5 min)"),
    label: tool4.schema.string().optional().describe("Human-readable label for this task")
  },
  async execute(args) {
    const { command, cwd, timeout, label } = args;
    const task = backgroundTaskManager.run({
      command,
      cwd: cwd || process.cwd(),
      timeout: timeout || 3e5,
      label
    });
    const displayLabel = label ? ` (${label})` : "";
    return `\u{1F680} **Background Task Started**${displayLabel}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
| Property | Value |
|----------|-------|
| **Task ID** | \`${task.id}\` |
| **Command** | \`${command}\` |
| **Status** | ${backgroundTaskManager.getStatusEmoji(task.status)} ${task.status} |
| **Working Dir** | ${task.cwd} |
| **Timeout** | ${(task.timeout / 1e3).toFixed(0)}s |
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F4CC} **Next Step**: Use \`check_background\` with task ID \`${task.id}\` to get results.`;
  }
});
var checkBackgroundTool = tool4({
  description: `Check the status and output of a background task.

<purpose>
Retrieve the current status and output of a previously started background task.
Use this after run_background to get results.
</purpose>

<output_includes>
- Status: running/done/error/timeout
- Exit code (if completed)
- Duration
- Full output (stdout + stderr)
</output_includes>`,
  args: {
    taskId: tool4.schema.string().describe("Task ID from run_background (e.g., job_a1b2c3d4)"),
    tailLines: tool4.schema.number().optional().describe("Limit output to last N lines (default: show all)")
  },
  async execute(args) {
    const { taskId, tailLines } = args;
    const task = backgroundTaskManager.get(taskId);
    if (!task) {
      const allTasks = backgroundTaskManager.getAll();
      if (allTasks.length === 0) {
        return `\u274C Task \`${taskId}\` not found. No background tasks exist.`;
      }
      const taskList = allTasks.map((t) => `- \`${t.id}\`: ${t.command.substring(0, 30)}...`).join("\n");
      return `\u274C Task \`${taskId}\` not found.

**Available tasks:**
${taskList}`;
    }
    const duration = backgroundTaskManager.formatDuration(task);
    const statusEmoji = backgroundTaskManager.getStatusEmoji(task.status);
    let output = task.output;
    let stderr = task.errorOutput;
    if (tailLines && tailLines > 0) {
      const outputLines = output.split("\n");
      const stderrLines = stderr.split("\n");
      output = outputLines.slice(-tailLines).join("\n");
      stderr = stderrLines.slice(-tailLines).join("\n");
    }
    const maxLen = 1e4;
    if (output.length > maxLen) {
      output = `[...truncated ${output.length - maxLen} chars...]
` + output.substring(output.length - maxLen);
    }
    if (stderr.length > maxLen) {
      stderr = `[...truncated ${stderr.length - maxLen} chars...]
` + stderr.substring(stderr.length - maxLen);
    }
    const labelDisplay = task.label ? ` (${task.label})` : "";
    let result = `${statusEmoji} **Task ${task.id}**${labelDisplay}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
| Property | Value |
|----------|-------|
| **Command** | \`${task.command}\` |
| **Status** | ${statusEmoji} **${task.status.toUpperCase()}** |
| **Duration** | ${duration}${task.status === "running" ? " (ongoing)" : ""} |
${task.exitCode !== null ? `| **Exit Code** | ${task.exitCode} |` : ""}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`;
    if (output.trim()) {
      result += `

\u{1F4E4} **Output (stdout)**:
\`\`\`
${output.trim()}
\`\`\``;
    }
    if (stderr.trim()) {
      result += `

\u26A0\uFE0F **Errors (stderr)**:
\`\`\`
${stderr.trim()}
\`\`\``;
    }
    if (task.status === "running") {
      result += `

\u23F3 Task still running... Check again later with:
\`check_background({ taskId: "${task.id}" })\``;
    }
    return result;
  }
});
var listBackgroundTool = tool4({
  description: `List all background tasks and their current status.

<purpose>
Get an overview of all running and completed background tasks.
Useful to check what's in progress before starting new tasks.
</purpose>`,
  args: {
    status: tool4.schema.enum(["all", "running", "done", "error"]).optional().describe("Filter by status (default: all)")
  },
  async execute(args) {
    const { status = "all" } = args;
    let tasks;
    if (status === "all") {
      tasks = backgroundTaskManager.getAll();
    } else {
      tasks = backgroundTaskManager.getByStatus(status);
    }
    if (tasks.length === 0) {
      return `\u{1F4CB} **No background tasks** ${status !== "all" ? `with status "${status}"` : ""}

Use \`run_background\` to start a new background task.`;
    }
    tasks.sort((a, b) => b.startTime - a.startTime);
    const rows = tasks.map((task) => {
      const emoji = backgroundTaskManager.getStatusEmoji(task.status);
      const duration = backgroundTaskManager.formatDuration(task);
      const cmdShort = task.command.length > 25 ? task.command.substring(0, 22) + "..." : task.command;
      const labelPart = task.label ? ` [${task.label}]` : "";
      return `| \`${task.id}\` | ${emoji} ${task.status.padEnd(7)} | ${cmdShort.padEnd(25)}${labelPart} | ${duration.padStart(8)} |`;
    }).join("\n");
    const runningCount = tasks.filter((t) => t.status === "running").length;
    const doneCount = tasks.filter((t) => t.status === "done").length;
    const errorCount = tasks.filter((t) => t.status === "error" || t.status === "timeout").length;
    return `\u{1F4CB} **Background Tasks** (${tasks.length} total)
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
| \u23F3 Running: ${runningCount} | \u2705 Done: ${doneCount} | \u274C Error/Timeout: ${errorCount} |
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

| Task ID | Status | Command | Duration |
|---------|--------|---------|----------|
${rows}

\u{1F4A1} Use \`check_background({ taskId: "job_xxxxx" })\` to see full output.`;
  }
});
var killBackgroundTool = tool4({
  description: `Kill a running background task.

<purpose>
Stop a background task that is taking too long or no longer needed.
</purpose>`,
  args: {
    taskId: tool4.schema.string().describe("Task ID to kill (e.g., job_a1b2c3d4)")
  },
  async execute(args) {
    const { taskId } = args;
    const task = backgroundTaskManager.get(taskId);
    if (!task) {
      return `\u274C Task \`${taskId}\` not found.`;
    }
    if (task.status !== "running") {
      return `\u26A0\uFE0F Task \`${taskId}\` is not running (status: ${task.status}).`;
    }
    const killed = backgroundTaskManager.kill(taskId);
    if (killed) {
      return `\u{1F6D1} Task \`${taskId}\` has been killed.
Command: \`${task.command}\`
Duration before kill: ${backgroundTaskManager.formatDuration(task)}`;
    }
    return `\u26A0\uFE0F Could not kill task \`${taskId}\`. It may have already finished.`;
  }
});

// src/core/async-agent.ts
var TASK_TTL_MS = 30 * 60 * 1e3;
var CLEANUP_DELAY_MS = 5 * 60 * 1e3;
var MIN_STABILITY_MS = 5 * 1e3;
var POLL_INTERVAL_MS = 2e3;
var DEFAULT_CONCURRENCY = 3;
var DEBUG = process.env.DEBUG_PARALLEL_AGENT === "true";
var log = (...args) => {
  if (DEBUG) console.log("[parallel-agent]", ...args);
};
var ConcurrencyController = class {
  counts = /* @__PURE__ */ new Map();
  queues = /* @__PURE__ */ new Map();
  limits = /* @__PURE__ */ new Map();
  setLimit(key, limit) {
    this.limits.set(key, limit);
  }
  getLimit(key) {
    return this.limits.get(key) ?? DEFAULT_CONCURRENCY;
  }
  async acquire(key) {
    const limit = this.getLimit(key);
    if (limit === 0) return;
    const current = this.counts.get(key) ?? 0;
    if (current < limit) {
      this.counts.set(key, current + 1);
      log(`Acquired slot for ${key}: ${current + 1}/${limit}`);
      return;
    }
    log(`Queueing for ${key}: ${current}/${limit} (waiting...)`);
    return new Promise((resolve) => {
      const queue = this.queues.get(key) ?? [];
      queue.push(resolve);
      this.queues.set(key, queue);
    });
  }
  release(key) {
    const limit = this.getLimit(key);
    if (limit === 0) return;
    const queue = this.queues.get(key);
    if (queue && queue.length > 0) {
      const next = queue.shift();
      log(`Released slot for ${key}: next in queue`);
      next();
    } else {
      const current = this.counts.get(key) ?? 0;
      if (current > 0) {
        this.counts.set(key, current - 1);
        log(`Released slot for ${key}: ${current - 1}`);
      }
    }
  }
  getQueueLength(key) {
    return this.queues.get(key)?.length ?? 0;
  }
};
var ParallelAgentManager = class _ParallelAgentManager {
  static _instance;
  // Core state
  tasks = /* @__PURE__ */ new Map();
  pendingByParent = /* @__PURE__ */ new Map();
  notifications = /* @__PURE__ */ new Map();
  // Dependencies
  client;
  directory;
  concurrency;
  // Polling
  pollingInterval;
  constructor(client, directory) {
    this.client = client;
    this.directory = directory;
    this.concurrency = new ConcurrencyController();
  }
  static getInstance(client, directory) {
    if (!_ParallelAgentManager._instance) {
      if (!client || !directory) {
        throw new Error("ParallelAgentManager requires client and directory on first call");
      }
      _ParallelAgentManager._instance = new _ParallelAgentManager(client, directory);
    }
    return _ParallelAgentManager._instance;
  }
  // ========================================================================
  // Public API
  // ========================================================================
  /**
   * Launch an agent in a new session (async, non-blocking)
   */
  async launch(input) {
    const concurrencyKey = input.agent;
    await this.concurrency.acquire(concurrencyKey);
    this.pruneExpiredTasks();
    try {
      const createResult = await this.client.session.create({
        body: {
          parentID: input.parentSessionID,
          title: `Parallel: ${input.description}`
        },
        query: {
          directory: this.directory
        }
      });
      if (createResult.error) {
        this.concurrency.release(concurrencyKey);
        throw new Error(`Failed to create session: ${createResult.error}`);
      }
      const sessionID = createResult.data.id;
      const taskId = `task_${crypto.randomUUID().slice(0, 8)}`;
      const task = {
        id: taskId,
        sessionID,
        parentSessionID: input.parentSessionID,
        description: input.description,
        agent: input.agent,
        status: "running",
        startedAt: /* @__PURE__ */ new Date(),
        concurrencyKey
      };
      this.tasks.set(taskId, task);
      this.trackPending(input.parentSessionID, taskId);
      this.startPolling();
      this.client.session.prompt({
        path: { id: sessionID },
        body: {
          agent: input.agent,
          parts: [{ type: "text", text: input.prompt }]
        }
      }).catch((error) => {
        log(`Prompt error for ${taskId}:`, error);
        this.handleTaskError(taskId, error);
      });
      log(`Launched ${taskId} in session ${sessionID}`);
      return task;
    } catch (error) {
      this.concurrency.release(concurrencyKey);
      throw error;
    }
  }
  /**
   * Get task by ID
   */
  getTask(id) {
    return this.tasks.get(id);
  }
  /**
   * Get all running tasks
   */
  getRunningTasks() {
    return Array.from(this.tasks.values()).filter((t) => t.status === "running");
  }
  /**
   * Get all tasks
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }
  /**
   * Get tasks by parent session
   */
  getTasksByParent(parentSessionID) {
    return Array.from(this.tasks.values()).filter((t) => t.parentSessionID === parentSessionID);
  }
  /**
   * Cancel a running task
   */
  async cancelTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "running") {
      return false;
    }
    task.status = "error";
    task.error = "Cancelled by user";
    task.completedAt = /* @__PURE__ */ new Date();
    if (task.concurrencyKey) {
      this.concurrency.release(task.concurrencyKey);
    }
    this.untrackPending(task.parentSessionID, taskId);
    try {
      await this.client.session.delete({
        path: { id: task.sessionID }
      });
    } catch {
    }
    this.scheduleCleanup(taskId);
    log(`Cancelled ${taskId}`);
    return true;
  }
  /**
   * Get result from completed task
   */
  async getResult(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    if (task.result) return task.result;
    if (task.status === "error") return `Error: ${task.error}`;
    if (task.status === "running") return null;
    try {
      const messagesResult = await this.client.session.messages({
        path: { id: task.sessionID }
      });
      if (messagesResult.error) {
        return `Error: ${messagesResult.error}`;
      }
      const messages = messagesResult.data ?? [];
      const assistantMsgs = messages.filter((m) => m.info?.role === "assistant").reverse();
      const lastMsg = assistantMsgs[0];
      if (!lastMsg) return "(No response)";
      const textParts = lastMsg.parts?.filter(
        (p) => p.type === "text" || p.type === "reasoning"
      ) ?? [];
      const result = textParts.map((p) => p.text ?? "").filter(Boolean).join("\n");
      task.result = result;
      return result;
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  /**
   * Set concurrency limit for agent type
   */
  setConcurrencyLimit(agentType, limit) {
    this.concurrency.setLimit(agentType, limit);
  }
  /**
   * Get pending notification count
   */
  getPendingCount(parentSessionID) {
    return this.pendingByParent.get(parentSessionID)?.size ?? 0;
  }
  /**
   * Cleanup all state
   */
  cleanup() {
    this.stopPolling();
    this.tasks.clear();
    this.pendingByParent.clear();
    this.notifications.clear();
  }
  // ========================================================================
  // Internal: Tracking
  // ========================================================================
  trackPending(parentSessionID, taskId) {
    const pending = this.pendingByParent.get(parentSessionID) ?? /* @__PURE__ */ new Set();
    pending.add(taskId);
    this.pendingByParent.set(parentSessionID, pending);
  }
  untrackPending(parentSessionID, taskId) {
    const pending = this.pendingByParent.get(parentSessionID);
    if (pending) {
      pending.delete(taskId);
      if (pending.size === 0) {
        this.pendingByParent.delete(parentSessionID);
      }
    }
  }
  // ========================================================================
  // Internal: Error Handling
  // ========================================================================
  handleTaskError(taskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = "error";
    task.error = error instanceof Error ? error.message : String(error);
    task.completedAt = /* @__PURE__ */ new Date();
    if (task.concurrencyKey) {
      this.concurrency.release(task.concurrencyKey);
    }
    this.untrackPending(task.parentSessionID, taskId);
    this.queueNotification(task);
    this.notifyParentIfAllComplete(task.parentSessionID);
    this.scheduleCleanup(taskId);
  }
  // ========================================================================
  // Internal: Polling
  // ========================================================================
  startPolling() {
    if (this.pollingInterval) return;
    this.pollingInterval = setInterval(() => {
      this.pollRunningTasks();
    }, POLL_INTERVAL_MS);
    this.pollingInterval.unref();
  }
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = void 0;
    }
  }
  async pollRunningTasks() {
    this.pruneExpiredTasks();
    const runningTasks = this.getRunningTasks();
    if (runningTasks.length === 0) {
      this.stopPolling();
      return;
    }
    try {
      const statusResult = await this.client.session.status();
      const allStatuses = statusResult.data ?? {};
      for (const task of runningTasks) {
        const sessionStatus = allStatuses[task.sessionID];
        if (sessionStatus?.type === "idle") {
          const elapsed = Date.now() - task.startedAt.getTime();
          if (elapsed < MIN_STABILITY_MS) continue;
          const hasOutput = await this.validateSessionHasOutput(task.sessionID);
          if (!hasOutput) continue;
          task.status = "completed";
          task.completedAt = /* @__PURE__ */ new Date();
          if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
          }
          this.untrackPending(task.parentSessionID, task.id);
          this.queueNotification(task);
          this.notifyParentIfAllComplete(task.parentSessionID);
          this.scheduleCleanup(task.id);
          log(`Completed ${task.id}`);
        }
      }
    } catch (error) {
      log("Polling error:", error);
    }
  }
  // ========================================================================
  // Internal: Validation
  // ========================================================================
  async validateSessionHasOutput(sessionID) {
    try {
      const response = await this.client.session.messages({
        path: { id: sessionID }
      });
      const messages = response.data ?? [];
      const hasContent = messages.some((m) => {
        if (m.info?.role !== "assistant") return false;
        const parts = m.parts ?? [];
        return parts.some(
          (p) => p.type === "text" && p.text?.trim() || p.type === "reasoning" && p.text?.trim() || p.type === "tool"
        );
      });
      return hasContent;
    } catch {
      return true;
    }
  }
  // ========================================================================
  // Internal: Cleanup & TTL
  // ========================================================================
  pruneExpiredTasks() {
    const now = Date.now();
    for (const [taskId, task] of this.tasks.entries()) {
      const age = now - task.startedAt.getTime();
      if (age > TASK_TTL_MS) {
        log(`Timeout: ${taskId} (${Math.round(age / 1e3)}s)`);
        if (task.status === "running") {
          task.status = "timeout";
          task.error = "Task exceeded 30 minute time limit";
          task.completedAt = /* @__PURE__ */ new Date();
          if (task.concurrencyKey) {
            this.concurrency.release(task.concurrencyKey);
          }
          this.untrackPending(task.parentSessionID, taskId);
        }
        this.tasks.delete(taskId);
      }
    }
    for (const [sessionID, queue] of this.notifications.entries()) {
      if (queue.length === 0) {
        this.notifications.delete(sessionID);
      }
    }
  }
  scheduleCleanup(taskId) {
    setTimeout(() => {
      this.tasks.delete(taskId);
      log(`Cleaned up ${taskId} from memory`);
    }, CLEANUP_DELAY_MS);
  }
  // ========================================================================
  // Internal: Notifications
  // ========================================================================
  queueNotification(task) {
    const queue = this.notifications.get(task.parentSessionID) ?? [];
    queue.push(task);
    this.notifications.set(task.parentSessionID, queue);
  }
  async notifyParentIfAllComplete(parentSessionID) {
    const pending = this.pendingByParent.get(parentSessionID);
    if (pending && pending.size > 0) {
      log(`${pending.size} tasks still pending for ${parentSessionID}`);
      return;
    }
    const completedTasks = this.notifications.get(parentSessionID) ?? [];
    if (completedTasks.length === 0) return;
    const summary = completedTasks.map((t) => {
      const status = t.status === "completed" ? "\u2705" : "\u274C";
      return `${status} \`${t.id}\`: ${t.description}`;
    }).join("\n");
    const notification = `<system-notification>
**All Parallel Tasks Complete**

${summary}

Use \`get_task_result({ taskId: "task_xxx" })\` to retrieve results.
</system-notification>`;
    try {
      await this.client.session.prompt({
        path: { id: parentSessionID },
        body: {
          noReply: true,
          parts: [{ type: "text", text: notification }]
        }
      });
      log(`Notified parent ${parentSessionID}: ${completedTasks.length} tasks`);
    } catch (error) {
      log("Notification error:", error);
    }
    this.notifications.delete(parentSessionID);
  }
  // ========================================================================
  // Internal: Formatting
  // ========================================================================
  formatDuration(start, end) {
    const duration = (end ?? /* @__PURE__ */ new Date()).getTime() - start.getTime();
    const seconds = Math.floor(duration / 1e3);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
};
var parallelAgentManager = {
  getInstance: ParallelAgentManager.getInstance.bind(ParallelAgentManager)
};

// src/tools/async-agent.ts
import { tool as tool5 } from "@opencode-ai/plugin";
var createSpawnAgentTool = (manager) => tool5({
  description: `Spawn an agent to run in a parallel session.

<purpose>
Launch an agent in a separate session that runs concurrently with your work.
Perfect for delegating tasks while continuing other analysis.
</purpose>

<safety>
- Max 3 agents per type (queued if at limit)
- Auto-timeout after 30 minutes
- Auto-cleanup from memory after 5 minutes
- System batches notifications (notifies when ALL complete)
</safety>

<workflow>
1. spawn_agent({ agent: "builder", ... }) \u2192 Returns task ID immediately
2. Continue your work (agent runs in background)
3. System notifies when ALL spawned agents complete
4. get_task_result({ taskId }) \u2192 Retrieve the result
</workflow>

<concurrency>
If you spawn 3 "builder" agents at limit, the 4th will queue
and start when a slot opens. Different agent types have separate limits.
</concurrency>`,
  args: {
    agent: tool5.schema.string().describe("Agent name (e.g., 'builder', 'inspector', 'architect')"),
    description: tool5.schema.string().describe("Short task description"),
    prompt: tool5.schema.string().describe("Full prompt/instructions for the agent")
  },
  async execute(args, context) {
    const { agent, description, prompt } = args;
    const ctx = context;
    try {
      const task = await manager.launch({
        agent,
        description,
        prompt,
        parentSessionID: ctx.sessionID
      });
      const runningCount = manager.getRunningTasks().length;
      const pendingCount = manager.getPendingCount(ctx.sessionID);
      return `\u{1F680} **Agent Spawned**
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
| Property | Value |
|----------|-------|
| **Task ID** | \`${task.id}\` |
| **Agent** | ${task.agent} |
| **Description** | ${task.description} |
| **Status** | \u23F3 running |
| **Total Running** | ${runningCount} |
| **Pending This Session** | ${pendingCount} |
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

\u{1F4CC} **Continue your work!** System notifies when ALL tasks complete.
Use \`get_task_result({ taskId: "${task.id}" })\` to check result later.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `\u274C Failed to spawn agent: ${message}`;
    }
  }
});
var createGetTaskResultTool = (manager) => tool5({
  description: `Get the result from a completed parallel task.

<note>
If the task is still running, returns status info.
Wait for the "All Complete" notification before checking.
</note>`,
  args: {
    taskId: tool5.schema.string().describe("Task ID from spawn_agent (e.g., 'task_a1b2c3d4')")
  },
  async execute(args) {
    const { taskId } = args;
    const task = manager.getTask(taskId);
    if (!task) {
      return `\u274C Task not found: \`${taskId}\`

Use \`list_tasks\` to see available tasks.`;
    }
    if (task.status === "running") {
      const elapsed = Math.floor((Date.now() - task.startedAt.getTime()) / 1e3);
      return `\u23F3 **Task Still Running**

| Property | Value |
|----------|-------|
| **Task ID** | \`${taskId}\` |
| **Agent** | ${task.agent} |
| **Elapsed** | ${elapsed}s |

Wait for "All Complete" notification, then try again.`;
    }
    const result = await manager.getResult(taskId);
    const duration = manager.formatDuration(task.startedAt, task.completedAt);
    if (task.status === "error" || task.status === "timeout") {
      return `\u274C **Task ${task.status === "timeout" ? "Timed Out" : "Failed"}**

| Property | Value |
|----------|-------|
| **Task ID** | \`${taskId}\` |
| **Agent** | ${task.agent} |
| **Error** | ${task.error} |
| **Duration** | ${duration} |`;
    }
    return `\u2705 **Task Completed**

| Property | Value |
|----------|-------|
| **Task ID** | \`${taskId}\` |
| **Agent** | ${task.agent} |
| **Duration** | ${duration} |

---

**Result:**

${result || "(No output)"}`;
  }
});
var createListTasksTool = (manager) => tool5({
  description: `List all parallel tasks and their status.`,
  args: {
    status: tool5.schema.string().optional().describe("Filter: 'all', 'running', 'completed', 'error'")
  },
  async execute(args) {
    const { status = "all" } = args;
    let tasks;
    switch (status) {
      case "running":
        tasks = manager.getRunningTasks();
        break;
      case "completed":
        tasks = manager.getAllTasks().filter((t) => t.status === "completed");
        break;
      case "error":
        tasks = manager.getAllTasks().filter((t) => t.status === "error" || t.status === "timeout");
        break;
      default:
        tasks = manager.getAllTasks();
    }
    if (tasks.length === 0) {
      return `\u{1F4CB} No parallel tasks found${status !== "all" ? ` (filter: ${status})` : ""}.

Use \`spawn_agent\` to launch agents in parallel.`;
    }
    const runningCount = manager.getRunningTasks().length;
    const completedCount = manager.getAllTasks().filter((t) => t.status === "completed").length;
    const errorCount = manager.getAllTasks().filter((t) => t.status === "error" || t.status === "timeout").length;
    const statusIcon = (s) => {
      switch (s) {
        case "running":
          return "\u23F3";
        case "completed":
          return "\u2705";
        case "error":
          return "\u274C";
        case "timeout":
          return "\u23F1\uFE0F";
        default:
          return "\u2753";
      }
    };
    const rows = tasks.map((t) => {
      const elapsed = Math.floor((Date.now() - t.startedAt.getTime()) / 1e3);
      const desc = t.description.length > 25 ? t.description.slice(0, 22) + "..." : t.description;
      return `| \`${t.id}\` | ${statusIcon(t.status)} ${t.status} | ${t.agent} | ${desc} | ${elapsed}s |`;
    }).join("\n");
    return `\u{1F4CB} **Parallel Tasks** (${tasks.length} shown)
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
| \u23F3 Running: ${runningCount} | \u2705 Completed: ${completedCount} | \u274C Error: ${errorCount} |
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

| Task ID | Status | Agent | Description | Elapsed |
|---------|--------|-------|-------------|---------|
${rows}

\u{1F4A1} Use \`get_task_result({ taskId: "task_xxx" })\` to get results.
\u{1F6D1} Use \`cancel_task({ taskId: "task_xxx" })\` to stop a running task.`;
  }
});
var createCancelTaskTool = (manager) => tool5({
  description: `Cancel a running parallel task.

<purpose>
Stop a runaway or no-longer-needed task.
Frees up concurrency slot for other tasks.
</purpose>`,
  args: {
    taskId: tool5.schema.string().describe("Task ID to cancel (e.g., 'task_a1b2c3d4')")
  },
  async execute(args) {
    const { taskId } = args;
    const cancelled = await manager.cancelTask(taskId);
    if (cancelled) {
      return `\u{1F6D1} **Task Cancelled**

Task \`${taskId}\` has been stopped. Concurrency slot released.`;
    }
    const task = manager.getTask(taskId);
    if (task) {
      return `\u26A0\uFE0F Cannot cancel: Task \`${taskId}\` is ${task.status} (not running).`;
    }
    return `\u274C Task \`${taskId}\` not found.

Use \`list_tasks\` to see available tasks.`;
  }
});
function createAsyncAgentTools(manager) {
  return {
    spawn_agent: createSpawnAgentTool(manager),
    get_task_result: createGetTaskResultTool(manager),
    list_tasks: createListTasksTool(manager),
    cancel_task: createCancelTaskTool(manager)
  };
}

// src/utils/common.ts
function detectSlashCommand(text) {
  const match = text.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
  if (!match) return null;
  return { command: match[1], args: match[2] || "" };
}
function formatTimestamp(date = /* @__PURE__ */ new Date()) {
  const pad = (n) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
function formatElapsedTime(startMs, endMs = Date.now()) {
  const elapsed = endMs - startMs;
  if (elapsed < 0) return "0s";
  const seconds = Math.floor(elapsed / 1e3) % 60;
  const minutes = Math.floor(elapsed / (1e3 * 60)) % 60;
  const hours = Math.floor(elapsed / (1e3 * 60 * 60));
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

// src/utils/sanity.ts
function checkOutputSanity(text) {
  if (!text || text.length < 50) {
    return { isHealthy: true, severity: "ok" };
  }
  if (/(.)\1{15,}/.test(text)) {
    return {
      isHealthy: false,
      reason: "Single character repetition detected",
      severity: "critical"
    };
  }
  if (/(.{2,6})\1{8,}/.test(text)) {
    return {
      isHealthy: false,
      reason: "Pattern loop detected",
      severity: "critical"
    };
  }
  if (text.length > 200) {
    const cleanText = text.replace(/\s/g, "");
    if (cleanText.length > 100) {
      const uniqueChars = new Set(cleanText).size;
      const ratio = uniqueChars / cleanText.length;
      if (ratio < 0.02) {
        return {
          isHealthy: false,
          reason: "Low information density",
          severity: "critical"
        };
      }
    }
  }
  const boxChars = (text.match(/[\u2500-\u257f\u2580-\u259f\u2800-\u28ff]/g) || []).length;
  if (boxChars > 100 && boxChars / text.length > 0.3) {
    return {
      isHealthy: false,
      reason: "Visual gibberish detected",
      severity: "critical"
    };
  }
  const lines = text.split("\n").filter((l) => l.trim().length > 10);
  if (lines.length > 10) {
    const lineSet = new Set(lines);
    if (lineSet.size < lines.length * 0.2) {
      return {
        isHealthy: false,
        reason: "Excessive line repetition",
        severity: "warning"
      };
    }
  }
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  if (cjkChars > 200) {
    const uniqueCjk = new Set(
      text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []
    ).size;
    if (uniqueCjk < 10 && cjkChars / uniqueCjk > 20) {
      return {
        isHealthy: false,
        reason: "CJK character spam detected",
        severity: "critical"
      };
    }
  }
  return { isHealthy: true, severity: "ok" };
}
var RECOVERY_PROMPT = `<anomaly_recovery>
\u26A0\uFE0F SYSTEM NOTICE: Previous output was malformed (gibberish/loop detected).

<recovery_protocol>
1. DISCARD the corrupted output completely - do not reference it
2. RECALL the original mission objective
3. IDENTIFY the last confirmed successful step
4. RESTART with a simpler, more focused approach
</recovery_protocol>

<instructions>
- If a sub-agent produced bad output: try a different agent or simpler task
- If stuck in a loop: break down the task into smaller pieces
- If context seems corrupted: call recorder to restore context
- THINK in English for maximum stability
</instructions>

What was the original task? Proceed from the last known good state.
</anomaly_recovery>`;
var ESCALATION_PROMPT = `<critical_anomaly>
\u{1F6A8} CRITICAL: Multiple consecutive malformed outputs detected.

<emergency_protocol>
1. STOP current execution path immediately
2. DO NOT continue with the same approach - it is failing
3. CALL architect for a completely new strategy
4. If architect also fails: report status to user and await guidance
</emergency_protocol>

<diagnosis>
The current approach is producing corrupted output.
This may indicate: context overload, model instability, or task complexity.
</diagnosis>

Request a fresh plan from architect with reduced scope.
</critical_anomaly>`;

// src/index.ts
var DEFAULT_MAX_STEPS = 500;
var TASK_COMMAND_MAX_STEPS = 1e3;
var AGENT_EMOJI2 = {
  "architect": "\u{1F3D7}\uFE0F",
  "builder": "\u{1F528}",
  "inspector": "\u{1F50D}",
  "recorder": "\u{1F4BE}",
  "commander": "\u{1F3AF}"
};
var CONTINUE_INSTRUCTION = `<auto_continue>
<status>Mission not complete. Keep executing.</status>

<rules>
1. DO NOT stop - mission is incomplete
2. DO NOT wait for user input
3. If previous action failed, try different approach
4. If agent returned nothing, proceed to next step
</rules>

<next_step>
What is the current state?
What is the next action?
Execute it NOW.
</next_step>
</auto_continue>`;
var OrchestratorPlugin = async (input) => {
  const { directory, client } = input;
  const sessions = /* @__PURE__ */ new Map();
  const parallelAgentManager2 = ParallelAgentManager.getInstance(client, directory);
  const asyncAgentTools = createAsyncAgentTools(parallelAgentManager2);
  return {
    // -----------------------------------------------------------------
    // Tools we expose to the LLM
    // -----------------------------------------------------------------
    tool: {
      call_agent: callAgentTool,
      slashcommand: createSlashcommandTool(),
      grep_search: grepSearchTool(directory),
      glob_search: globSearchTool(directory),
      mgrep: mgrepTool(directory),
      // Multi-pattern grep (parallel, Rust-powered)
      // Background task tools - run shell commands asynchronously
      run_background: runBackgroundTool,
      check_background: checkBackgroundTool,
      list_background: listBackgroundTool,
      kill_background: killBackgroundTool,
      // Async agent tools - spawn agents in parallel sessions
      ...asyncAgentTools
    },
    // -----------------------------------------------------------------
    // Config hook - registers our commands and agents with OpenCode
    // -----------------------------------------------------------------
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
        Commander: {
          name: "Commander",
          description: "Autonomous orchestrator - executes until mission complete",
          systemPrompt: AGENTS.commander.systemPrompt
        }
      };
      config.command = { ...orchestratorCommands, ...existingCommands };
      config.agent = { ...orchestratorAgents, ...existingAgents };
    },
    // -----------------------------------------------------------------
    // chat.message hook - runs when user sends a message
    // This is where we intercept commands and set up sessions
    // -----------------------------------------------------------------
    "chat.message": async (msgInput, msgOutput) => {
      const parts = msgOutput.parts;
      const textPartIndex = parts.findIndex((p) => p.type === "text" && p.text);
      if (textPartIndex === -1) return;
      const originalText = parts[textPartIndex].text || "";
      const parsed = detectSlashCommand(originalText);
      const sessionID = msgInput.sessionID;
      const agentName = (msgInput.agent || "").toLowerCase();
      if (agentName === "commander" && !sessions.has(sessionID)) {
        const now = Date.now();
        sessions.set(sessionID, {
          active: true,
          step: 0,
          maxSteps: DEFAULT_MAX_STEPS,
          timestamp: now,
          startTime: now,
          lastStepTime: now
        });
        state.missionActive = true;
        state.sessions.set(sessionID, {
          enabled: true,
          iterations: 0,
          taskRetries: /* @__PURE__ */ new Map(),
          currentTask: "",
          anomalyCount: 0
        });
        if (!parsed) {
          const userMessage = originalText.trim();
          if (userMessage) {
            parts[textPartIndex].text = COMMANDS["task"].template.replace(
              /\$ARGUMENTS/g,
              userMessage
            );
          }
        }
      }
      if (parsed?.command === "task") {
        const now = Date.now();
        sessions.set(sessionID, {
          active: true,
          step: 0,
          maxSteps: TASK_COMMAND_MAX_STEPS,
          timestamp: now,
          startTime: now,
          lastStepTime: now
        });
        state.missionActive = true;
        state.sessions.set(sessionID, {
          enabled: true,
          iterations: 0,
          taskRetries: /* @__PURE__ */ new Map(),
          currentTask: "",
          anomalyCount: 0
        });
        parts[textPartIndex].text = COMMANDS["task"].template.replace(
          /\$ARGUMENTS/g,
          parsed.args || "continue previous work"
        );
      } else if (parsed) {
        const command = COMMANDS[parsed.command];
        if (command) {
          parts[textPartIndex].text = command.template.replace(
            /\$ARGUMENTS/g,
            parsed.args || "continue"
          );
        }
      }
    },
    // -----------------------------------------------------------------
    // tool.execute.after hook - runs after any tool call completes
    // We use this to track progress and detect problems
    // -----------------------------------------------------------------
    "tool.execute.after": async (toolInput, toolOutput) => {
      const session = sessions.get(toolInput.sessionID);
      if (!session?.active) return;
      const now = Date.now();
      const stepDuration = formatElapsedTime(session.lastStepTime, now);
      const totalElapsed = formatElapsedTime(session.startTime, now);
      session.step++;
      session.timestamp = now;
      session.lastStepTime = now;
      const stateSession = state.sessions.get(toolInput.sessionID);
      if (toolInput.tool === "call_agent" && stateSession) {
        const sanityResult = checkOutputSanity(toolOutput.output);
        if (!sanityResult.isHealthy) {
          stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
          const agentName = toolInput.arguments?.agent || "unknown";
          toolOutput.output = `\u26A0\uFE0F [${agentName.toUpperCase()}] OUTPUT ANOMALY DETECTED

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u26A0\uFE0F Gibberish/loop detected: ${sanityResult.reason}
Anomaly count: ${stateSession.anomalyCount}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

` + (stateSession.anomalyCount >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT);
          return;
        } else {
          if (stateSession.anomalyCount > 0) {
            stateSession.anomalyCount = 0;
          }
          if (toolOutput.output.length < 5e3) {
            stateSession.lastHealthyOutput = toolOutput.output.substring(0, 1e3);
          }
        }
      }
      if (toolInput.tool === "call_agent" && toolInput.arguments?.task && stateSession) {
        const taskIdMatch = toolInput.arguments.task.match(/\[(TASK-\d+)\]/i);
        if (taskIdMatch) {
          stateSession.currentTask = taskIdMatch[1].toUpperCase();
          stateSession.graph?.updateTask(stateSession.currentTask, { status: "running" });
        }
        const agentName = toolInput.arguments.agent;
        const emoji = AGENT_EMOJI2[agentName] || "\u{1F916}";
        toolOutput.output = `${emoji} [${agentName.toUpperCase()}] Working...

` + toolOutput.output;
      }
      if (session.step >= session.maxSteps) {
        session.active = false;
        state.missionActive = false;
        return;
      }
      if (toolOutput.output.includes("[") && toolOutput.output.includes("{") && toolInput.tool === "call_agent" && stateSession) {
        const jsonMatch = toolOutput.output.match(/```json\n([\s\S]*?)\n```/) || toolOutput.output.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        if (jsonMatch) {
          try {
            const tasks = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            if (Array.isArray(tasks) && tasks.length > 0) {
              stateSession.graph = new TaskGraph(tasks);
              toolOutput.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2705 INITIALIZED
${stateSession.graph.getTaskSummary()}`;
            }
          } catch {
          }
        }
      }
      if (stateSession?.graph) {
        const taskId = stateSession.currentTask;
        if (toolOutput.output.includes("\u2705 PASS") || toolOutput.output.includes("AUDIT RESULT: PASS")) {
          if (taskId) {
            stateSession.graph.updateTask(taskId, { status: "completed" });
            stateSession.taskRetries.clear();
            toolOutput.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2705 ${taskId} VERIFIED
${stateSession.graph.getTaskSummary()}`;
          }
        } else if (toolOutput.output.includes("\u274C FAIL") || toolOutput.output.includes("AUDIT RESULT: FAIL")) {
          if (taskId) {
            const retries = (stateSession.taskRetries.get(taskId) || 0) + 1;
            stateSession.taskRetries.set(taskId, retries);
            if (retries >= state.maxRetries) {
              stateSession.graph.updateTask(taskId, { status: "failed" });
              toolOutput.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u26A0\uFE0F ${taskId} FAILED (${retries}x)`;
            } else {
              toolOutput.output += `

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u{1F504} RETRY ${retries}/${state.maxRetries}`;
            }
          }
        }
        const readyTasks = stateSession.graph.getReadyTasks();
        if (readyTasks.length > 0) {
          toolOutput.output += `
\u{1F449} NEXT: ${readyTasks.map((t) => `[${t.id}]`).join(", ")}`;
        }
      }
      const currentTime = formatTimestamp();
      toolOutput.output += `

\u23F1\uFE0F [${currentTime}] Step ${session.step}/${session.maxSteps} | This step: ${stepDuration} | Total: ${totalElapsed}`;
    },
    // -----------------------------------------------------------------
    // assistant.done hook - runs when the LLM finishes responding
    // This is the heart of the "relentless loop" - we keep pushing it
    // to continue until we see MISSION COMPLETE or hit the limit
    // -----------------------------------------------------------------
    "assistant.done": async (assistantInput, assistantOutput) => {
      const sessionID = assistantInput.sessionID;
      const session = sessions.get(sessionID);
      if (!session?.active) return;
      const parts = assistantOutput.parts;
      const textContent = parts?.filter((p) => p.type === "text" || p.type === "reasoning").map((p) => p.text || "").join("\n") || "";
      const stateSession = state.sessions.get(sessionID);
      const sanityResult = checkOutputSanity(textContent);
      if (!sanityResult.isHealthy && stateSession) {
        stateSession.anomalyCount = (stateSession.anomalyCount || 0) + 1;
        session.step++;
        session.timestamp = Date.now();
        const recoveryText = stateSession.anomalyCount >= 2 ? ESCALATION_PROMPT : RECOVERY_PROMPT;
        try {
          if (client?.session?.prompt) {
            await client.session.prompt({
              path: { id: sessionID },
              body: {
                parts: [{
                  type: "text",
                  text: `\u26A0\uFE0F ANOMALY #${stateSession.anomalyCount}: ${sanityResult.reason}

` + recoveryText + `

[Recovery Step ${session.step}/${session.maxSteps}]`
                }]
              }
            });
          }
        } catch {
          session.active = false;
          state.missionActive = false;
        }
        return;
      }
      if (stateSession && stateSession.anomalyCount > 0) {
        stateSession.anomalyCount = 0;
      }
      if (textContent.includes("\u2705 MISSION COMPLETE") || textContent.includes("MISSION COMPLETE")) {
        session.active = false;
        state.missionActive = false;
        sessions.delete(sessionID);
        state.sessions.delete(sessionID);
        return;
      }
      if (textContent.includes("/stop") || textContent.includes("/cancel")) {
        session.active = false;
        state.missionActive = false;
        sessions.delete(sessionID);
        state.sessions.delete(sessionID);
        return;
      }
      const now = Date.now();
      const stepDuration = formatElapsedTime(session.lastStepTime, now);
      const totalElapsed = formatElapsedTime(session.startTime, now);
      session.step++;
      session.timestamp = now;
      session.lastStepTime = now;
      const currentTime = formatTimestamp();
      if (session.step >= session.maxSteps) {
        session.active = false;
        state.missionActive = false;
        return;
      }
      try {
        if (client?.session?.prompt) {
          await client.session.prompt({
            path: { id: sessionID },
            body: {
              parts: [{
                type: "text",
                text: CONTINUE_INSTRUCTION + `

\u23F1\uFE0F [${currentTime}] Step ${session.step}/${session.maxSteps} | This step: ${stepDuration} | Total: ${totalElapsed}`
              }]
            }
          });
        }
      } catch {
        try {
          await new Promise((r) => setTimeout(r, 500));
          if (client?.session?.prompt) {
            await client.session.prompt({
              path: { id: sessionID },
              body: { parts: [{ type: "text", text: "continue" }] }
            });
          }
        } catch {
          session.active = false;
          state.missionActive = false;
        }
      }
    },
    // -----------------------------------------------------------------
    // Event handler - cleans up when sessions are deleted
    // -----------------------------------------------------------------
    handler: async ({ event }) => {
      if (event.type === "session.deleted") {
        const props = event.properties;
        if (props?.info?.id) {
          sessions.delete(props.info.id);
          state.sessions.delete(props.info.id);
        }
      }
    }
  };
};
var index_default = OrchestratorPlugin;
export {
  index_default as default
};
