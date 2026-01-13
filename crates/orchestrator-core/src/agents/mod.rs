//! Agent management and definitions

mod definition;
mod manager;
mod prompts;

pub use definition::{Agent, AgentId, AgentPermissions};
pub use manager::AgentManager;
