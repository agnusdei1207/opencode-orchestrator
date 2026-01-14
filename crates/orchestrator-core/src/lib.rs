//! OpenCode Orchestrator Core Library
//!
//! This crate provides the core logic for the OpenCode Orchestrator plugin,
//! including hooks, tools, and configuration handling.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────┐
//! │                    orchestrator-core                    │
//! ├─────────────────────────────────────────────────────────┤
//! │  hooks/      - Pre/Post tool execution hooks           │
//! │  tools/      - Tool implementations (LSP, grep, etc)    │
//! │  config/     - Configuration loading and validation     │
//! │  features/   - Feature modules (skills, MCP, etc)       │
//! └─────────────────────────────────────────────────────────┘
//! ```

pub mod config;
pub mod error;
pub mod hooks;
pub mod tools;

pub use config::OrchestratorConfig;
pub use error::{Error, Result};
