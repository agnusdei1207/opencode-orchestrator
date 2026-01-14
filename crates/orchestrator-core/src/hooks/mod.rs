//! Hooks Module
//!
//! Hooks are features that run automatically before/after tool execution.

mod registry;
mod types;

pub use registry::HookRegistry;
pub use types::{Hook, HookOutput, HookResult, HookTiming, ToolContext};
