import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version: PLUGIN_VERSION } = require("../package.json");

import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { MissionController } from "./core/mission/mission-controller.js";
import { ResourceTracker } from "./core/resource/resource-tracker.js";
import { ParallelAgentManager } from "./core/agents/index.js";
import { log } from "./core/agents/logger.js";
import { SESSION_EVENTS, TOOL_NAMES } from "./shared/index.js";

// Tool imports
import { callAgentTool } from "./tools/callAgent.js";
import { createSlashcommandTool } from "./tools/slashCommand.js";
import {
    grepSearchTool,
    globSearchTool,
    mgrepTool,
    sedReplaceTool,
    diffTool,
    jqTool,
    httpTool,
    fileStatsTool,
    gitDiffTool,
    gitStatusTool,
} from "./tools/search.js";
import {
    runBackgroundTool,
    checkBackgroundTool,
    listBackgroundTool,
    killBackgroundTool,
} from "./tools/background-cmd/index.js";
import { createAsyncAgentTools } from "./tools/parallel/index.js";
import { astSearchTool, astReplaceTool } from "./tools/ast/index.js";
import { webfetchTool, websearchTool, cacheDocsTool, codesearchTool } from "./tools/web/index.js";
import { lspDiagnosticsTool } from "./tools/lsp/index.js";

const OrchestratorPlugin: Plugin = async (input) => {
    const { directory, client } = input;

    // Initialize systems
    const resourceTracker = ResourceTracker.getInstance();
    const parallelAgentManager = ParallelAgentManager.getInstance(client, directory);
    const asyncAgentTools = createAsyncAgentTools(parallelAgentManager, client);

    // Active missions (Main Session ID -> Controller)
    const missions = new Map<string, MissionController>();

    const hooks: Hooks = {
        // -----------------------------------------------------------------
        // Tools exposure
        // -----------------------------------------------------------------
        tool: {
            [TOOL_NAMES.CALL_AGENT]: callAgentTool,
            [TOOL_NAMES.SLASHCOMMAND]: createSlashcommandTool(),
            [TOOL_NAMES.GREP_SEARCH]: grepSearchTool(directory),
            [TOOL_NAMES.GLOB_SEARCH]: globSearchTool(directory),
            [TOOL_NAMES.MGREP]: mgrepTool(directory),
            [TOOL_NAMES.SED_REPLACE]: sedReplaceTool(directory),
            [TOOL_NAMES.DIFF]: diffTool(),
            [TOOL_NAMES.JQ]: jqTool(),
            [TOOL_NAMES.HTTP]: httpTool(),
            [TOOL_NAMES.FILE_STATS]: fileStatsTool(directory),
            [TOOL_NAMES.GIT_DIFF]: gitDiffTool(directory),
            [TOOL_NAMES.GIT_STATUS]: gitStatusTool(directory),
            [TOOL_NAMES.RUN_BACKGROUND]: runBackgroundTool,
            [TOOL_NAMES.CHECK_BACKGROUND]: checkBackgroundTool,
            [TOOL_NAMES.LIST_BACKGROUND]: listBackgroundTool,
            [TOOL_NAMES.KILL_BACKGROUND]: killBackgroundTool,
            [TOOL_NAMES.WEBFETCH]: webfetchTool,
            [TOOL_NAMES.WEBSEARCH]: websearchTool,
            [TOOL_NAMES.CACHE_DOCS]: cacheDocsTool,
            [TOOL_NAMES.CODESEARCH]: codesearchTool,
            [TOOL_NAMES.LSP_DIAGNOSTICS]: lspDiagnosticsTool(directory),
            [TOOL_NAMES.AST_SEARCH]: astSearchTool(directory),
            [TOOL_NAMES.AST_REPLACE]: astReplaceTool(directory),
            ...asyncAgentTools,
        },

        // -----------------------------------------------------------------
        // chat.message hook: Intercept /task command
        // -----------------------------------------------------------------
        "chat.message": async (msgInput, msgOutput) => {
            const parts = msgOutput.parts;
            // Find text part safely using any cast since the SDK types are complex
            const textPart = parts.find(p => p.type === 'text') as any;
            if (!textPart || typeof textPart.text !== 'string') return;

            const text = textPart.text;
            const match = text.match(/^\/task\s+"(.+)"$/);

            if (match) {
                const prompt = match[1];
                const mission = new MissionController(input);
                const sessionID = await mission.start(prompt);

                missions.set(sessionID, mission);

                // Transform the original message into the Commander initiation prompt
                textPart.text = (mission as any).buildCommanderPrompt(prompt);
                log(`[Orchestrator] Mission started for session ${sessionID.slice(0, 8)}`);
            }
        },

        // -----------------------------------------------------------------
        // event hook: Handle loop continuation and cleanup
        // -----------------------------------------------------------------
        event: async (payload) => {
            const { event } = payload;

            // Pass to agent manager for session pool handling
            parallelAgentManager.handleEvent(event as any);

            // 1. Cleanup on session deletion
            if (event.type === SESSION_EVENTS.DELETED) {
                const sessionID = (event.properties as any)?.id || (event.properties as any)?.info?.id;
                if (sessionID) {
                    await resourceTracker.releaseAllForSession(sessionID);
                    missions.delete(sessionID);
                }
            }

            // 2. Loop continuation on session idle
            if (event.type === SESSION_EVENTS.IDLE) {
                const sessionID = (event.properties as any)?.sessionID || (event.properties as any)?.id;
                const mission = missions.get(sessionID);

                if (mission) {
                    // Small delay to ensure all logs/todos are processed by the server
                    setTimeout(async () => {
                        const result = await mission.nextIteration();
                        if (!result.continue) {
                            missions.delete(sessionID);
                            log(`[Orchestrator] Mission finished for ${sessionID.slice(0, 8)}: ${result.reason}`);
                        }
                    }, 1000);
                }
            }
        },

        // -----------------------------------------------------------------
        // Safe tool execution before hook
        // -----------------------------------------------------------------
        "tool.execute.before": async (ctx, output) => {
            // Block dangerous commands here if needed
        }
    };

    return hooks;
};

export default OrchestratorPlugin;
