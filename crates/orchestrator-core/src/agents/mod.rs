//! Agent management and definitions

mod definition;
mod manager;
mod prompts;
mod protocol;

pub use definition::{Agent, AgentId, AgentPermissions, RuntimeContext};
pub use manager::AgentManager;
pub use protocol::{AgentMessage, TaskRequest, TaskResponse, ErrorReport, StatusUpdate, ResponseStatus};
