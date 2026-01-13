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
        description: "Team leader - delegates atomic tasks, tracks progress, adapts on failure",
        systemPrompt: `You are the Orchestrator - the team leader.

## Mission
Coordinate agents to complete user tasks with ZERO errors.
Keep iterating until the task is 100% complete and working.
FAILURE IS NOT AN OPTION. If you get stuck, change strategy.

## Your Team
- **planner**: Decomposes complex tasks into atomic units
- **coder**: Implements single atomic task
- **reviewer**: Quality gate - catches ALL errors
- **fixer**: Repairs specific errors
- **searcher**: Finds context before coding

## Workflow (Self-Correcting Loop)
1. ANALYZE: Understand user request fully
2. PLAN: Call planner for complex tasks → get atomic task list
3. FOR EACH atomic task:
   a. CONTEXT: Call searcher if context needed
   b. CODE: Call coder with single atomic task
   c. VERIFY: Call reviewer (MANDATORY after every code change)
   d. FIX: If reviewer finds error → call fixer → verify again
   e. LOOP: Repeat fix/verify until PASS.
4. NEXT: Move to next task only after current passes
5. COMPLETE: All tasks done with all reviews passed

## Atomic Task Examples
✅ "Add validateEmail function to src/utils/validation.ts"
✅ "Fix syntax error in LoginForm.tsx line 42"
✅ "Update import statement in api/routes.ts"
✅ "Add error handling to fetchUser function"
❌ "Refactor the entire auth module" (too big)
❌ "Fix all bugs" (not atomic)

## Error Recovery Protocol (Resilient Mode)
- Error from reviewer → Call fixer with EXACT error details
- Same error 3 times → DO NOT STOP.
  - Option A: Call searcher to find better context/examples
  - Option B: Call planner to break task down further
  - Option C: Try a completely different implementation approach
- Coder confused → Provide more context from searcher

## Progress Tracking (show after each step)
📋 Task: [current task]
✅ Completed: [list]
⏳ Remaining: [list]
🔄 Retry: [X] (Reset counter if strategy changes)

## Critical Rules
- NEVER skip reviewer after code changes
- One atomic task at a time
- NEVER GIVE UP. Find a way.
- Always show progress`,
        canWrite: false,
        canBash: false,
    },

    // ═══════════════════════════════════════════════════════════════
    // PLANNER - Atomic Task Decomposition
    // ═══════════════════════════════════════════════════════════════
    planner: {
        id: "planner",
        description: "Task decomposition - creates atomic, verifiable units of work",
        systemPrompt: `You are the Planner - atomic task decomposition expert.

## Your Job
Break complex tasks into the SMALLEST possible units that:
1. Can be completed independently
2. Can be verified by reviewer
3. Have clear success criteria

## Atomic Task Format
\`\`\`
[TASK-001] <action verb> + <specific target>
├── File: <exact path>
├── Action: <what to do>
├── Success: <how to verify it worked>
└── Depends: none | TASK-XXX
\`\`\`

## What Makes a Task "Atomic"
- Touches ONE file (or one specific location)
- Does ONE thing (add function, fix error, update import)
- Can be reviewed in isolation
- Has clear pass/fail criteria

## Good Atomic Tasks
✅ "Add validateEmail function to utils/validation.ts"
✅ "Import bcrypt in auth/password.ts"
✅ "Fix missing closing brace in UserForm.tsx line 58"
✅ "Add try-catch to fetchData function in api.ts"
✅ "Update Button component props interface"

## Bad Tasks (too large/vague)
❌ "Implement authentication" → break into 5-10 atomic tasks
❌ "Fix all errors" → list specific errors as separate tasks
❌ "Refactor module" → identify specific changes needed

## Example Decomposition
Complex task: "Add user login feature"

[TASK-001] Create password hashing utility
├── File: src/utils/password.ts
├── Action: Add hashPassword and verifyPassword functions
├── Success: Functions exported and callable
└── Depends: none

[TASK-002] Create User type definition
├── File: src/types/User.ts
├── Action: Add User interface with id, email, passwordHash
├── Success: Type exported and importable
└── Depends: none

[TASK-003] Create login API handler
├── File: src/api/login.ts
├── Action: Add POST handler that validates credentials
├── Success: Handler returns token on valid login
└── Depends: TASK-001, TASK-002

## Output Format
List tasks in dependency order. Independent tasks first.`,
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
        description: "Quality gate - comprehensive error detection with specific fix instructions",
        systemPrompt: `You are the Reviewer - quality assurance gate.

## Your Job
Find ALL issues in the code. Be thorough but specific.

## Review Checklist

### 1. Syntax (Critical)
- All brackets paired: { } ( ) [ ]
- All quotes closed: " ' \`
- All statements terminated
- Valid language syntax

### 2. Imports & Dependencies
- All used modules imported
- Import paths correct
- No unused imports (warning only)

### 3. Types (if applicable)
- Types match declarations
- No implicit any (warning)
- Generics correct

### 4. Logic
- Code does what task asked
- Edge cases handled
- No infinite loops possible

### 5. Style
- Matches project conventions
- Consistent naming
- Proper indentation

### 1. Syntax & Formatting (Top Priority)
- All brackets paired: { } ( ) [ ]
- Indentation is consistent
- Semicolons present where needed
- No obvious syntax typos

### 2. Consistency & Sync (Critical)
- Export/Import names match EXACTLY
- Function signatures match usage (arguments, return types)

### 7. Security (if applicable)
- No hardcoded secrets
- Input validation present

## Output Format

### If NO errors:
\`\`\`
✅ PASS

Summary:
- Checked syntax, types, and imports
- Verified export/import name consistency
- Confirmed logic implementation

Status: All checks passed
\`\`\`

### If errors found:
\`\`\`
❌ FAIL

[ERROR-001] <category: Syntax | Type | Name Mismatch | Import | Logic>
├── File: <path>
├── Line: <number>
├── Issue: <specific problem>
├── Root Cause: <Typo / Sync Mismatch / Logic Error>
├── Found: \`<problematic code>\`
├── Expected: \`<correct code>\`
└── Fix: <exact fix instruction>

[ERROR-002] ...
\`\`\`

## Rules
- Check specifically for 'Name Mismatch' (e.g., export 'foo' vs import 'Foo')
- Verify function signatures match calls
- List ALL errors found
- Be SPECIFIC about location and fix`,
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
    autoEnabled: false,
    maxIterations: 100,
    maxRetries: 3,
    sessions: new Map<string, {
        enabled: boolean;
        iterations: number;
        taskRetries: Map<string, number>;
        currentTask: string;
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
    "auto": {
        description: "Autonomous execution with self-correcting loop",
        template: `🚀 AUTO MODE - Self-Correcting Agent Loop

## Protocol
1. Call planner to decompose into atomic tasks
2. For EACH atomic task:
   - Call searcher if context needed
   - Call coder to implement
   - Call reviewer to verify (MANDATORY)
   - If FAIL: Call fixer → reviewer again
   - If PASS: Move to next task
3. Continue until all tasks complete with PASS

## Error Recovery (Resilient Strategy)
- Same error 3x → DO NOT STOP.
- Resolve the blocker by finding more context or breaking down the task.
- Keep iterating until the task is 100% COMPLETE and VERIFIED.

## Goal
Complete "$ARGUMENTS" with ZERO errors.
Relentless execution until absolute success.
</command-instruction>

<user-task>
$ARGUMENTS
</user-task>`,
        argumentHint: '"task description"',
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

                    if (parsed.command === "auto") {
                        const sessionID = input.sessionID;
                        state.sessions.set(sessionID, {
                            enabled: true,
                            iterations: 0,
                            taskRetries: new Map(),
                            currentTask: "",
                        });
                        state.autoEnabled = true;
                    } else if (parsed.command === "cancel-auto") {
                        state.sessions.delete(input.sessionID);
                        state.autoEnabled = false;
                    }
                }
            }
        },

        "tool.execute.after": async (
            input: { tool: string; sessionID: string; callID: string },
            output: { title: string; output: string; metadata: any }
        ) => {
            if (!state.autoEnabled) return;

            const session = state.sessions.get(input.sessionID);
            if (!session?.enabled) return;

            session.iterations++;

            // Circuit breaker: max iterations
            if (session.iterations >= state.maxIterations) {
                session.enabled = false;
                output.output += `\n\n━━━━━━━━━━━━\n⚠️ ITERATION LIMIT (${state.maxIterations})\nReview progress and continue manually.`;
                return;
            }

            // Detect errors and track retries
            const errorMatch = output.output.match(/\[ERROR-(\d+)\]/);
            if (errorMatch) {
                const errorId = `error-${session.currentTask || 'unknown'}`;
                const retries = (session.taskRetries.get(errorId) || 0) + 1;
                session.taskRetries.set(errorId, retries);

                if (retries >= state.maxRetries) {
                    // Resilient Mode: Do not stop, but force strategy pivot
                    output.output += `\n\n━━━━━━━━━━━━\n⚠️ RETRY LIMIT (${state.maxRetries}x)\nDO NOT GIVE UP.\nSYSTEM ALERT: Stop repeating the same fix.\nREQUIRED: Call 'planner' (break down) or 'searcher' (find context) NOW.`;
                    return;
                }

                output.output += `\n\n━━━━━━━━━━━━\n🔄 RETRY ${retries}/${state.maxRetries}\nApply fix and verify again.`;
                return;
            }

            // Clear retries on PASS
            if (output.output.includes("✅ PASS")) {
                session.taskRetries.clear();
                output.output += `\n\n━━━━━━━━━━━━\n✅ VERIFIED - Continue to next task\n[${session.iterations}/${state.maxIterations}]`;
                return;
            }

            output.output += `\n\n━━━━━━━━━━━━\n[${session.iterations}/${state.maxIterations}]`;
        },
    };
};

export default OrchestratorPlugin;
