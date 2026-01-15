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
//! │  background/ - Background task execution               │
//! └─────────────────────────────────────────────────────────┘
//! ```

pub mod background;
pub mod config;
pub mod error;
pub mod hooks;
pub mod tools;

pub use background::{
    run_background, check_background, list_background, kill_background,
    clear_completed, format_duration, status_emoji,
    BackgroundTask, TaskStatus,
};
pub use config::OrchestratorConfig;
pub use error::{Error, Result};

