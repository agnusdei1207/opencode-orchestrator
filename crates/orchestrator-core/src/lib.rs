//! OpenCode Orchestrator Core Library
//!
//! This crate provides the tool implementations that the `orchestrator`
//! binary serves to the OpenCode Orchestrator plugin.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────┐
//! │                    orchestrator-core                    │
//! ├─────────────────────────────────────────────────────────┤
//! │  tools/      - Tool implementations (LSP, grep, etc)    │
//! └─────────────────────────────────────────────────────────┘
//! ```

pub mod constants;
pub mod error;
pub mod tools;

pub use error::{Error, Result};
