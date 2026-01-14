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
6. LANGUAGE: THINK and REASON in English for maximum stability. Report final summary in Korean.
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

// src/utils/common.ts
function detectSlashCommand(text) {
  const match = text.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
  if (!match) return null;
  return { command: match[1], args: match[2] || "" };
}

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
  return {
    tool: {
      call_agent: callAgentTool,
      slashcommand: createSlashcommandTool(),
      grep_search: grepSearchTool(directory),
      glob_search: globSearchTool(directory)
    },
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
    "chat.message": async (msgInput, msgOutput) => {
      const parts = msgOutput.parts;
      const textPartIndex = parts.findIndex((p) => p.type === "text" && p.text);
      if (textPartIndex === -1) return;
      const originalText = parts[textPartIndex].text || "";
      const parsed = detectSlashCommand(originalText);
      const sessionID = msgInput.sessionID;
      const agentName = (msgInput.agent || "").toLowerCase();
      if (agentName === "commander" && !sessions.has(sessionID)) {
        sessions.set(sessionID, {
          active: true,
          step: 0,
          maxSteps: DEFAULT_MAX_STEPS,
          timestamp: Date.now()
        });
        state.missionActive = true;
        state.sessions.set(sessionID, {
          enabled: true,
          iterations: 0,
          taskRetries: /* @__PURE__ */ new Map(),
          currentTask: ""
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
        sessions.set(sessionID, {
          active: true,
          step: 0,
          maxSteps: TASK_COMMAND_MAX_STEPS,
          timestamp: Date.now()
        });
        state.missionActive = true;
        state.sessions.set(sessionID, {
          enabled: true,
          iterations: 0,
          taskRetries: /* @__PURE__ */ new Map(),
          currentTask: ""
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
    "tool.execute.after": async (toolInput, toolOutput) => {
      const session = sessions.get(toolInput.sessionID);
      if (!session?.active) return;
      session.step++;
      session.timestamp = Date.now();
      const stateSession = state.sessions.get(toolInput.sessionID);
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
      toolOutput.output += `

[${session.step}/${session.maxSteps}]`;
    },
    "assistant.done": async (assistantInput, assistantOutput) => {
      const sessionID = assistantInput.sessionID;
      const session = sessions.get(sessionID);
      if (!session?.active) return;
      const parts = assistantOutput.parts;
      const textContent = parts?.filter((p) => p.type === "text" || p.type === "reasoning").map((p) => p.text || "").join("\n") || "";
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
      session.step++;
      session.timestamp = Date.now();
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

[Step ${session.step}/${session.maxSteps}]`
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
