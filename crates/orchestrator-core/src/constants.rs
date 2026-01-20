//! Shared constants for OpenCode Orchestrator
//! 
//! CRITICAL: These constants must be synchronized with the TypeScript 
//! implementation (tests/unit/rust-tools-wrapper.test.ts and various tool definitions).
//! Since we communicate via JSON RPC over stdio, any mismatch in these strings 
//! will break the integration between the Rust CLI and the TypeScript plugin.

/// Agent identification names.
/// Used in system prompts and agent registration.
pub mod agent {
    pub const COMMANDER: &str = "Commander";
    pub const PLANNER: &str = "Planner";
    pub const WORKER: &str = "Worker";
    pub const REVIEWER: &str = "Reviewer";
}

/// Status labels used in tool responses and system-wide state.
/// Standardized as lowercase strings.
pub mod status {
    pub const CLEAN: &str = "clean";
    pub const WARNING: &str = "warning";
    pub const ERROR: &str = "error";
    pub const SUCCESS: &str = "success";
    pub const OK: &str = "ok";
    pub const FAILED: &str = "failed";
    pub const PENDING: &str = "pending";
    pub const RUNNING: &str = "running";
}

/// Canonical tool names used in rpc::TOOLS_CALL.
pub mod tool {
    pub const GREP_SEARCH: &str = "grep_search";
    pub const GLOB_SEARCH: &str = "glob_search";
    pub const MGREP: &str = "mgrep";
    pub const SED_REPLACE: &str = "sed_replace";
    pub const DIFF: &str = "diff";
    pub const JQ: &str = "jq";
    pub const HTTP: &str = "http";
    pub const FILE_STATS: &str = "file_stats";
    pub const GIT_DIFF: &str = "git_diff";
    pub const GIT_STATUS: &str = "git_status";
    pub const LSP_DIAGNOSTICS: &str = "lsp_diagnostics";
    pub const AST_SEARCH: &str = "ast_search";
    pub const AST_REPLACE: &str = "ast_replace";
    pub const LIST_AGENTS: &str = "list_agents";
    pub const LIST_HOOKS: &str = "list_hooks";
}

/// JSON RPC method names and protocol constants.
pub mod rpc {
    pub const VERSION: &str = "2.0";
    pub const INITIALIZE: &str = "initialize";
    pub const TOOLS_LIST: &str = "tools/list";
    pub const TOOLS_CALL: &str = "tools/call";
    
    // Protocol Metadata
    pub const PROTOCOL_VERSION: &str = "2024-11-05";
}

/// Field names used in JSON RPC requests and responses.
/// Ensures that we access/create JSON objects with consistent keys.
pub mod field {
    pub const METHOD: &str = "method";
    pub const ID: &str = "id";
    pub const PARAMS: &str = "params";
    pub const RESULT: &str = "result";
    pub const ERROR: &str = "error";
    pub const CONTENT: &str = "content";
    pub const TYPE: &str = "type";
    pub const TEXT: &str = "text";
    pub const IS_ERROR: &str = "isError";
}
