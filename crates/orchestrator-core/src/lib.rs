//! OpenCode Orchestrator Core Library
//!
//! This crate provides the core logic for the OpenCode Orchestrator plugin,
//! including hooks and tools.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────┐
//! │                    orchestrator-core                    │
//! ├─────────────────────────────────────────────────────────┤
//! │  hooks/      - Pre/Post tool execution hooks           │
//! │  tools/      - Tool implementations (LSP, grep, etc)    │
//! └─────────────────────────────────────────────────────────┘
//! ```

pub mod constants;
pub mod error;
pub mod hooks;
pub mod tools;

pub use error::{Error, Result};
