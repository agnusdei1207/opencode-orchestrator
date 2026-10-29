//! OpenCode Orchestrator CLI
//!
//! Operator CLI bundled with the OpenCode Orchestrator npm package.
//!
//! ## Usage
//!
//! ```bash
//! # Help
//! orchestrator --help
//!
//! # Run the authorized lab TCP session listener
//! orchestrator shell-listener --help
//! ```

use anyhow::Result;
use std::env;

mod shell_listener;

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();

    match args.get(1).map(|s| s.as_str()) {
        Some("shell-listener") => shell_listener::run(&args[2..]),
        Some("--version") | Some("-V") => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        Some("--help") | Some("-h") | None => {
            print_help();
            Ok(())
        }
        Some(cmd) => {
            eprintln!("Unknown command: {}", cmd);
            print_help();
            std::process::exit(1);
        }
    }
}

fn print_help() {
    eprintln!("OpenCode Orchestrator v{}", env!("CARGO_PKG_VERSION"));
    eprintln!();
    eprintln!("Usage: orchestrator <command>");
    eprintln!();
    eprintln!("Commands:");
    eprintln!("  shell-listener  Run authorized lab TCP session TUI");
    eprintln!("  --version       Show version");
    eprintln!("  --help          Show this help");
}
