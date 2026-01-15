# Changelog

All notable changes to this project will be documented in this file.

---

## [Unreleased] - 2026-01-15

### Added
- **Background Tasks** (`job_xxxx`)
  - `run_background`: Execute commands asynchronously in background
  - `check_background`: Poll task status and retrieve output
  - `list_background`: View all background jobs with status
  - `kill_background`: Terminate running jobs

- **mgrep**: Multi-pattern parallel grep
  - Search multiple regex patterns simultaneously
  - Rust-native parallel execution for maximum performance
  - Returns results grouped by pattern

- **Rust Implementation**
  - `crates/orchestrator-core/src/background.rs` - Background task manager
  - File-based state persistence at `/tmp/opencode-orchestrator/jobs.json`

- **Documentation**
  - `docs/BACKGROUND_TASKS_IMPLEMENTATION.md` - Full implementation details

### Changed
- Task ID prefix changed from `bg_` to `job_` for clarity
- Commander prompt now reports in English (previously Korean)
- Updated `README.md` with Rust performance note and mgrep feature
- Updated `docs/ARCHITECTURE.md` with background task section

### Fixed
- Final report language changed from Korean to English for international users

---

## [0.2.3] - 2026-01-14

### Added
- Relentless Loop feature for Commander agent
- Auto mission mode activation

### Changed
- Improved agent prompts for better stability

---

## [0.2.0] - 2026-01-13

### Added
- 5-agent architecture (Commander, Architect, Builder, Inspector, Recorder)
- Progressive phase workflow (Triage → Scan → Plan → Execute → Verify)
- Rust-powered grep and glob search tools

### Changed
- Migrated from 6-agent to 5-agent architecture

---

## [0.1.0] - 2026-01-10

### Added
- Initial release
- Basic multi-agent orchestration
- OpenCode plugin integration
