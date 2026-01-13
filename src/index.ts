/**
 * OpenCode Orchestrator Plugin
 *
 * 6-Agent Collaborative Architecture for OpenCode
 * 
 * Philosophy: Cheap models (GLM-4.7, Gemma, Phi) can outperform
 * expensive models through intelligent task decomposition and
 * team collaboration with quality gates.
 */

import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, writeFileSync, readFileSync, mkdirSync } from "fs";
import { platform, arch } from "os";
import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";
import { TaskGraph, type Task } from "./tasks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// 6-Agent Collaborative Architecture
// ============================================================================

interface AgentDefinition {
    id: string;
    description: string;
    systemPrompt: string;
    canWrite: boolean;
    canBash: boolean;
}

const AGENTS: Record<string, AgentDefinition> = {
    // ═══════════════════════════════════════════════════════════════
    // ORCHESTRATOR - Team Leader & Decision Maker
    // ═══════════════════════════════════════════════════════════════
    orchestrator: {
        id: "orchestrator",
        description: "Team leader - manages the Task DAG and parallel work streams",
        systemPrompt: `You are the Orchestrator - the mission commander.

## Core Philosophy: Micro-Tasking & Quality Gates
- Even small models (Phi, Gemma) succeed when tasks are tiny and verified.
- Your job is to manage the **Task DAG** (Directed Acyclic Graph).
- NEVER proceed to a task if its dependencies are not 100% VERIFIED.

## Operational SOP (Standard Operating Procedure)
1. **PLAN**: Call planner to get a JSON-based DAG of atomic tasks.
2. **SCHEDULE**: Identify all tasks with 0 pending dependencies.
3. **EXECUTE**: For each ready task:
   a. **SEARCH**: Call searcher to find context (Codebase patterns, types).
   b. **CODE**: Call coder to implement the change.
   c. **REVIEW**: Call reviewer (Style Guardian) to verify (MANDATORY).
   d. **FIX**: If FAIL, call fixer with exact error → review again.
4. **PARALLELIZE**: You can run independent tasks concurrently.
5. **VERIFY**: All tasks must be ✅ PASS before mission completion.

## Failure Recovery SOP
- **Error 1-2**: Call fixer as usual.
- **Error 3**: Pivot. Call searcher for similar fixes or planner to split the task further.
- **Syntax Error**: Fixer MUST only fix syntax, no logic changes.

## Reliable Execution with Fixed Models
- This system is optimized for fixed, low-performance models (Phi, Gemma, etc.).
- Performance is achieved through granularity, not model upgrades.

## Progress Status
Always show the DAG status at the end of your turns:
📋 DAG Status:
[TASK-001] ✅ Completed
[TASK-002] ⏳ Running
[TASK-003] 💤 Pending`,
        canWrite: false,
        canBash: false,
    },

    // ═══════════════════════════════════════════════════════════════
    // PLANNER - Atomic Task Decomposition
    // ═══════════════════════════════════════════════════════════════
    planner: {
        id: "planner",
        description: "Architect - decomposes work into a JSON Task DAG",
        systemPrompt: `You are the Planner - the master architect.

## Your Mission
Decompose complex requests into a **Directed Acyclic Graph (DAG)** of micro-tasks. 
Each task must be so small that even a weak LLM can execute it perfectly.

## Task Classification
1. **INFRASTRUCTURE**: Interfaces, types, directory structure, boilerplate.
2. **LOGIC**: Core functions, algorithms, business rules.
3. **INTEGRATION**: API callers, file I/O, event handlers.

## SOP: Atomic Task Creation
- **Single File**: A task should only touch ONE file.
- **Single Responsibility**: A task should do ONE thing (e.g., "Add interface", not "Add interface and implement it").
- **Verification Ready**: Every task MUST have clear "Success Criteria".

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
        canBash: false,
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

## Common Mistakes to Avoid
- Forgetting closing brackets
- Missing imports
- Using wrong variable names
- Type mismatches
- Breaking existing code

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
        canBash: true,
    },

    // ═══════════════════════════════════════════════════════════════
    // REVIEWER - Quality Gate
    // ═══════════════════════════════════════════════════════════════
    reviewer: {
        id: "reviewer",
        description: "Style Guardian - prevents regressions and style drift",
        systemPrompt: `You are the Reviewer - the Style Guardian.

## Your Job
Enforce absolute technical perfection and style consistency. 
You are the gatekeeper. Nothing merges if it's not perfect.

## SOP: The 5-Point Check
1. **SYNTAX (Fatal)**: Brackets, semicolons, quotes. Must be 100% valid.
2. **STYLE (Consistency)**: 
   - Naming must match project (camelCase vs snake_case).
   - Indentation must match.
   - Quotation style must be consistent.
3. **LOGIC (Correctness)**: Does it fulfill the task EXACTLY? No more, no less.
4. **INTEGRITY (Sync)**: 
   - Export names must match imports in other files.
   - Function signatures must match calls.
5. **SECURITY**: No secrets, no unsafe eval, no implicit any.

## Review Results (MANDATORY Format)

### If PASS:
\`\`\`
✅ PASS (Confidence: 100%)
- Syntax validated.
- Style matches project conventions.
- Logic addresses the task.
\`\`\`

### If FAIL:
\`\`\`
❌ FAIL

[ERROR-001] <Category: Style | Syntax | Logic>
├── File: <path>
├── Issue: <description>
├── Found: \`<bad code>\`
├── Expected: \`<good code>\`
└── Fix: <precise instruction for Fixer agent>
\`\`\`

## Rules
- Be pedantic. 
- If even one semicolon is missing, FAIL it.
- Never "suggest" a fix - COMMAND the fix.`,
        canWrite: false,
        canBash: true,
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
├── File: <path>
├── Line: <number>
├── Issue: <problem>
├── Found: \`<bad code>\`
├── Expected: \`<good code>\`
└── Fix: <instruction>
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
        canBash: true,
    },

    // ═══════════════════════════════════════════════════════════════
    // SEARCHER - Context Provider
    // ═══════════════════════════════════════════════════════════════
    searcher: {
        id: "searcher",
        description: "Context provider - finds patterns, examples, and project conventions",
        systemPrompt: `You are the Searcher - context provider.

## Your Job
Find relevant patterns and context BEFORE coder starts working.

## Tools
- grep_search: Find text/code patterns
- glob_search: Find files by name

## What to Find
1. Similar implementations in codebase
2. Import patterns and style
3. Type definitions being used
4. Existing utility functions
5. Project conventions

## Output Format
\`\`\`
### Found Patterns

[PATTERN-1] <name>
File: <path>
Relevant code:
\`\`\`<lang>
<code snippet>
\`\`\`

[PATTERN-2] ...

### Recommendations for Coder
- Use <pattern> from <file>
- Follow <convention>
- Import from <path>
\`\`\`

## Guidelines
- Show actual code, not just file paths
- Focus on most relevant 3-5 findings
- Note project conventions
- Warn about gotchas`,
        canWrite: false,
        canBash: false,
    },
};

// ============================================================================
// Binary Management
// ============================================================================

function getBinaryPath(): string {
    const binDir = join(__dirname, "..", "bin");
    const os = platform();
    const cpu = arch();

    let binaryName: string;
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

async function callRustTool(name: string, args: Record<string, unknown>): Promise<string> {
    const binary = getBinaryPath();
    if (!existsSync(binary)) {
        return JSON.stringify({ error: `Binary not found: ${binary}` });
    }

    return new Promise((resolve) => {
        const proc = spawn(binary, ["serve"], { stdio: ["pipe", "pipe", "pipe"] });
        let stdout = "";

        proc.stdout.on("data", (data) => { stdout += data.toString(); });

        const request = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: { name, arguments: args },
        });

        proc.stdin.write(request + "\n");
        proc.stdin.end();

        const timeout = setTimeout(() => { proc.kill(); resolve(JSON.stringify({ error: "Timeout" })); }, 60000);

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

// ============================================================================
// State Management
// ============================================================================

const state = {
    dagActive: false,
    maxIterations: 100,
    maxRetries: 3,
    sessions: new Map<string, {
        enabled: boolean;
        iterations: number;
        taskRetries: Map<string, number>;
        currentTask: string;
        graph?: TaskGraph;
    }>(),
};

// ============================================================================
// call_agent Tool
// ============================================================================

const callAgentTool = tool({
    description: `Call a team member to perform specific work.

## Team
- **planner**: Decompose complex task into atomic units
- **coder**: Implement single atomic task
- **reviewer**: Quality check (ALWAYS after coder)
- **fixer**: Fix specific errors from reviewer
- **searcher**: Find patterns and context

## Self-Correcting Workflow
1. planner → atomic tasks
2. For each task:
   - searcher (if needed)
   - coder
   - reviewer (mandatory)
   - fixer (if errors) → reviewer again
3. Continue until all pass`,
    args: {
        agent: tool.schema
            .enum(["planner", "coder", "reviewer", "fixer", "searcher"])
            .describe("Team member to call"),
        task: tool.schema.string().describe("Atomic task or specific error to address"),
        context: tool.schema.string().optional().describe("Relevant context from previous steps"),
    },
    async execute(args) {
        const agentDef = AGENTS[args.agent];
        if (!agentDef) {
            return `Error: Unknown agent: ${args.agent}`;
        }

        // Extract task ID for tracking if available
        const taskIdMatch = args.task.match(/\[(TASK-\d+)\]/i);
        if (taskIdMatch) {
            // Set current task in state for the session (we'll need access to sessionID here)
            // Note: tool.execute doesn't easily have sessionID unless passed in args or context.
            // But we can rely on tool.execute.before or after to sync this.
        }

        const prompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${agentDef.id.toUpperCase()} AGENT
${agentDef.description}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<system>
${agentDef.systemPrompt}
</system>

<task>
${args.task}
</task>

${args.context ? `<context>\n${args.context}\n</context>` : ""}

Execute according to your role. Be thorough and precise.
`;

        return prompt;
    },
});

// ============================================================================
// Slash Commands
// ============================================================================

const COMMANDS: Record<string, { description: string; template: string; argumentHint?: string }> = {
    "dag": {
        description: "Execute task using Parallel DAG Orchestration (High Reliability)",
        template: `🚀 MISSION: DAG ORCHESTRATION
<command-instruction>
You are operating in DAG MODE. You must strictly follow the Task Graph.

## Mission Protocol (SOP)
1. **DECOMPOSE**: Call **planner** to create a JSON-based Task DAG.
2. **RESOLVE**: Only execute tasks that have ALL dependencies satisfied (READY status).
3. **VALIDATE**: Every change must be reviewed by **reviewer** (Style Guardian).
4. **PARALLEL**: You can initiate multiple READY tasks if they don't conflict.

## Goal
Complete "$ARGUMENTS" using the DAG methodology. 
Ensure 100% style consistency and zero regressions.
</command-instruction>

<user-task>
$ARGUMENTS
</user-task>`,
        argumentHint: '"mission goal"',
    },
    "plan": {
        description: "Decompose task into atomic units",
        template: `<agent-prompt agent="planner">
Decompose into atomic tasks:
$ARGUMENTS
</agent-prompt>`,
        argumentHint: '"complex task"',
    },
    "review": {
        description: "Quality check with error detection",
        template: `<agent-prompt agent="reviewer">
Review for ALL issues:
$ARGUMENTS
</agent-prompt>`,
        argumentHint: '"code to review"',
    },
    "fix": {
        description: "Fix specific errors",
        template: `<agent-prompt agent="fixer">
Fix these errors:
$ARGUMENTS
</agent-prompt>`,
        argumentHint: '"error details"',
    },
    "search": {
        description: "Find patterns and context",
        template: `<agent-prompt agent="searcher">
Find patterns for:
$ARGUMENTS
</agent-prompt>`,
        argumentHint: '"what to find"',
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
plan → (search → code → review → fix?) → repeat
\`\`\``,
    },
    "cancel-auto": {
        description: "Stop auto mode",
        template: `Auto mode stopped.`,
    },
};

// ============================================================================
// Slash Command Tool
// ============================================================================

function createSlashcommandTool() {
    const commandList = Object.entries(COMMANDS)
        .map(([name, cmd]) => {
            const hint = cmd.argumentHint ? ` ${cmd.argumentHint}` : "";
            return `- /${name}${hint}: ${cmd.description}`;
        })
        .join("\n");

    return tool({
        description: `Commands\n\n${commandList}`,
        args: {
            command: tool.schema.string().describe("Command (without slash)"),
        },
        async execute(args) {
            const cmdName = (args.command || "").replace(/^\//, "").split(/\s+/)[0].toLowerCase();
            const cmdArgs = (args.command || "").replace(/^\/?\\S+\s*/, "");

            if (!cmdName) return `Commands:\n${commandList}`;

            const command = COMMANDS[cmdName];
            if (!command) return `Unknown: /${cmdName}\n\n${commandList}`;

            return command.template.replace(/\$ARGUMENTS/g, cmdArgs || "continue");
        },
    });
}

// ============================================================================
// Search Tools
// ============================================================================

const grepSearchTool = (directory: string) => tool({
    description: "Search code patterns",
    args: {
        pattern: tool.schema.string().describe("Regex pattern"),
        dir: tool.schema.string().optional().describe("Directory"),
    },
    async execute(args) {
        return callRustTool("grep_search", {
            pattern: args.pattern,
            directory: args.dir || directory,
        });
    },
});

const globSearchTool = (directory: string) => tool({
    description: "Find files by pattern",
    args: {
        pattern: tool.schema.string().describe("Glob pattern"),
        dir: tool.schema.string().optional().describe("Directory"),
    },
    async execute(args) {
        return callRustTool("glob_search", {
            pattern: args.pattern,
            directory: args.dir || directory,
        });
    },
});

// ============================================================================
// Utilities
// ============================================================================

function detectSlashCommand(text: string): { command: string; args: string } | null {
    const match = text.trim().match(/^\/([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
    if (!match) return null;
    return { command: match[1], args: match[2] || "" };
}

// ============================================================================
// Plugin
// ============================================================================

const OrchestratorPlugin = async (input: PluginInput) => {
    const { directory } = input;

    return {
        tool: {
            call_agent: callAgentTool,
            slashcommand: createSlashcommandTool(),
            grep_search: grepSearchTool(directory),
            glob_search: globSearchTool(directory),
        },

        // Register commands so they appear in OpenCode's autocomplete menu
        config: async (config: Record<string, unknown>) => {
            const existingCommands = (config.command as Record<string, unknown>) ?? {};

            // Convert COMMANDS to OpenCode command format
            const orchestratorCommands: Record<string, unknown> = {};
            for (const [name, cmd] of Object.entries(COMMANDS)) {
                orchestratorCommands[name] = {
                    description: cmd.description,
                    template: cmd.template,
                    argumentHint: cmd.argumentHint, // Crucial for autocomplete menu
                };
            }

            config.command = {
                ...orchestratorCommands,
                ...existingCommands,
            };
        },

        "chat.message": async (input: any, output: any) => {
            const parts = output.parts as Array<{ type: string; text?: string }>;
            const textPartIndex = parts.findIndex(p => p.type === "text" && p.text);
            if (textPartIndex === -1) return;

            const originalText = parts[textPartIndex].text || "";
            const parsed = detectSlashCommand(originalText);

            if (parsed) {
                const command = COMMANDS[parsed.command];
                if (command) {
                    parts[textPartIndex].text = command.template.replace(/\$ARGUMENTS/g, parsed.args || "continue");

                    if (parsed.command === "dag" || parsed.command === "auto" || parsed.command === "ignite") {
                        const sessionID = input.sessionID;
                        state.sessions.set(sessionID, {
                            enabled: true,
                            iterations: 0,
                            taskRetries: new Map(),
                            currentTask: "",
                        });
                        state.dagActive = true;
                    } else if (parsed.command === "stop" || parsed.command === "cancel") {
                        state.sessions.delete(input.sessionID);
                        state.dagActive = false;
                    }
                }
            }
        },

        "tool.execute.after": async (
            input: { tool: string; sessionID: string; callID: string; arguments?: any },
            output: { title: string; output: string; metadata: any }
        ) => {
            if (!state.dagActive) return;

            const session = state.sessions.get(input.sessionID);
            if (!session?.enabled) return;

            session.iterations++;

            // Track current task from call_agent arguments
            if (input.tool === "call_agent" && input.arguments?.task) {
                const taskIdMatch = input.arguments.task.match(/\[(TASK-\d+)\]/i);
                if (taskIdMatch) {
                    session.currentTask = taskIdMatch[1].toUpperCase();
                    session.graph?.updateTask(session.currentTask, { status: "running" });
                }
            }

            // Circuit breaker: max iterations
            if (session.iterations >= state.maxIterations) {
                session.enabled = false;
                output.output += `\n\n━━━━━━━━━━━━\n⚠️ ITERATION LIMIT (${state.maxIterations})\nReview progress and continue manually.`;
                return;
            }

            if (output.output.includes("[") && output.output.includes("]") && output.output.includes("{") && input.tool === "call_agent") {
                // Try to detect and parse Planner JSON output
                const jsonMatch = output.output.match(/```json\n([\s\S]*?)\n```/) || output.output.match(/\[\s+\{[\s\S]*?\}\s+\]/);
                if (jsonMatch) {
                    try {
                        const tasks = JSON.parse(jsonMatch[1] || jsonMatch[0]) as Task[];
                        if (Array.isArray(tasks) && tasks.length > 0) {
                            session.graph = new TaskGraph(tasks);
                            output.output += `\n\n━━━━━━━━━━━━\n✅ TASK DAG INITIALIZED\n${session.graph.getTaskSummary()}`;
                        }
                    } catch (e) {
                        // Not valid JSON or not planner output, ignore
                    }
                }
            }

            // Sync TaskGraph status based on agent output
            if (session.graph) {
                if (output.output.includes("✅ PASS")) {
                    const taskId = session.currentTask;
                    if (taskId) {
                        session.graph.updateTask(taskId, { status: "completed" });
                        session.taskRetries.clear();
                        output.output += `\n\n━━━━━━━━━━━━\n✅ TASK ${taskId} VERIFIED\n${session.graph.getTaskSummary()}`;
                    }
                } else if (output.output.includes("❌ FAIL")) {
                    const taskId = session.currentTask;
                    if (taskId) {
                        const errorId = `error-${taskId}`;
                        const retries = (session.taskRetries.get(errorId) || 0) + 1;
                        session.taskRetries.set(errorId, retries);
                        if (retries >= state.maxRetries) {
                            session.graph.updateTask(taskId, { status: "failed" });
                            output.output += `\n\n━━━━━━━━━━━━\n⚠️ TASK ${taskId} FAILED (Retry Limit)\nPIVOT REQUIRED: Re-plan or seek context.`;
                        } else {
                            output.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries} for ${taskId}`;
                        }
                    }
                }
            } else {
                // Legacy fallback for non-DAG mode
                const errorMatch = output.output.match(/\[ERROR-(\d+)\]/);
                if (errorMatch) {
                    const errorId = `error-${session.currentTask || 'unknown'}`;
                    const retries = (session.taskRetries.get(errorId) || 0) + 1;
                    session.taskRetries.set(errorId, retries);

                    if (retries >= state.maxRetries) {
                        output.output += `\n\n━━━━━━━━━━━━\n⚠️ RETRY LIMIT (${state.maxRetries}x)\nPIVOT REQUIRED.`;
                        return;
                    }

                    output.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries}`;
                    return;
                }

                if (output.output.includes("✅ PASS")) {
                    session.taskRetries.clear();
                    output.output += `\n\n━━━━━━━━━━━━\n✅ VERIFIED`;
                    return;
                }
            }

            // Append DAG Status and Guidance
            if (session.graph) {
                const readyTasks = session.graph.getReadyTasks();
                const guidance = readyTasks.length > 0
                    ? `\n👉 **READY TO EXECUTE**: ${readyTasks.map(t => `[${t.id}]`).join(", ")}`
                    : `\n⚠️ NO READY TASKS. Check dependencies or completion.`;

                output.output += `\n\n━━━━━━━━━━━━\n${session.graph.getTaskSummary()}${guidance}`;
            }

            output.output += `\n\n━━━━━━━━━━━━\n[DAG STEP: ${session.iterations}/${state.maxIterations}]`;
        },
    };
};

export default OrchestratorPlugin;
