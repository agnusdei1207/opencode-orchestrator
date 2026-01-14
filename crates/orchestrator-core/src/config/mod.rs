//! Configuration handling for OpenCode Orchestrator

mod loader;
mod schema;

pub use loader::ConfigLoader;
pub use schema::*;

use crate::Result;
use std::path::Path;

/// Load configuration from project and user directories
pub fn load_config(project_dir: &Path) -> Result<OrchestratorConfig> {
    ConfigLoader::new(project_dir).load()
}
