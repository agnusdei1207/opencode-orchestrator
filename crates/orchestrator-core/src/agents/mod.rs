//! Agent management and definitions

mod definition;
mod manager;
mod prompts;

pub use definition::{Agent, AgentId, AgentPermissions, RuntimeContext};
pub use manager::AgentManager;

