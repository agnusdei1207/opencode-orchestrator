/**
 * Tool Registry - Centralized tool registration
 *
 * Consolidates all tool definitions for cleaner plugin initialization
 */

import type { ToolDefinition } from "@opencode-ai/plugin";
import { createSlashcommandTool } from "./slashCommand.js";
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
} from "./search.js";
import {
    runBackgroundTool,
    checkBackgroundTool,
    listBackgroundTool,
    killBackgroundTool,
} from "./background-cmd/index.js";
import { astSearchTool, astReplaceTool } from "./ast/index.js";
import { lspDiagnosticsTool } from "./lsp/index.js";
import { TOOL_NAMES } from "../shared/index.js";

/**
 * Register all search and utility tools
 */
function registerSearchTools(directory: string): Record<string, ToolDefinition> {
    return {
        [TOOL_NAMES.GREP_SEARCH]: grepSearchTool(directory),
        [TOOL_NAMES.GLOB_SEARCH]: globSearchTool(directory),
        [TOOL_NAMES.MGREP]: mgrepTool(directory),
        [TOOL_NAMES.SED_REPLACE]: sedReplaceTool(directory),
        [TOOL_NAMES.DIFF]: diffTool(),
        [TOOL_NAMES.JQ]: jqTool(),
        [TOOL_NAMES.HTTP]: httpTool(),
        [TOOL_NAMES.FILE_STATS]: fileStatsTool(directory),
    };
}

/**
 * Register Git tools
 */
function registerGitTools(directory: string): Record<string, ToolDefinition> {
    return {
        [TOOL_NAMES.GIT_DIFF]: gitDiffTool(directory),
        [TOOL_NAMES.GIT_STATUS]: gitStatusTool(directory),
    };
}

/**
 * Register background task tools
 */
function registerBackgroundTools(): Record<string, ToolDefinition> {
    return {
        [TOOL_NAMES.RUN_BACKGROUND]: runBackgroundTool,
        [TOOL_NAMES.CHECK_BACKGROUND]: checkBackgroundTool,
        [TOOL_NAMES.LIST_BACKGROUND]: listBackgroundTool,
        [TOOL_NAMES.KILL_BACKGROUND]: killBackgroundTool,
    };
}

/**
 * Register AST tools
 */
function registerAstTools(directory: string): Record<string, ToolDefinition> {
    return {
        [TOOL_NAMES.AST_SEARCH]: astSearchTool(directory),
        [TOOL_NAMES.AST_REPLACE]: astReplaceTool(directory),
    };
}

/**
 * Register LSP tools
 */
function registerLspTools(directory: string): Record<string, ToolDefinition> {
    return {
        [TOOL_NAMES.LSP_DIAGNOSTICS]: lspDiagnosticsTool(directory),
    };
}

/**
 * Register core orchestrator tools
 */
function registerCoreTools(): Record<string, ToolDefinition> {
    return {
        [TOOL_NAMES.SLASHCOMMAND]: createSlashcommandTool(),
    };
}

function assertNoToolConflicts(
    registeredTools: Record<string, ToolDefinition>,
    candidateTools: Record<string, ToolDefinition>,
    source: string
): void {
    for (const name of Object.keys(candidateTools)) {
        if (registeredTools[name]) {
            throw new Error(`${source} tool conflicts with registered tool: ${name}`);
        }
    }
}

/**
 * Register all tools in one place
 * @param directory - Working directory
 * @param asyncAgentTools - Parallel agent tools from ParallelAgentManager
 * @returns Complete tool registry
 */
export function registerAllTools(
    directory: string,
    asyncAgentTools: Record<string, ToolDefinition>
): Record<string, ToolDefinition> {
    const baseTools = {
        ...registerCoreTools(),
        ...registerSearchTools(directory),
        ...registerGitTools(directory),
        ...registerBackgroundTools(),
        ...registerAstTools(directory),
        ...registerLspTools(directory),
    };

    assertNoToolConflicts(baseTools, asyncAgentTools, "Async agent");

    return {
        ...baseTools,
        ...asyncAgentTools,
    };

}
