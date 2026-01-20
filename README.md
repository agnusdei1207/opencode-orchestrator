<div align="center">
  <img src="assets/logo.png" alt="logo" width="280" />
  <h1>OpenCode Orchestrator</h1>

  [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
  [![Tests](https://img.shields.io/badge/tests-216%20passed-brightgreen.svg)]()
</div>

> **Multi-Agent Orchestration Plugin for [OpenCode](https://opencode.ai)**


## ⚡ Quick Start

```bash
npm install -g opencode-orchestrator
```

Then in OpenCode:
```bash
/task "Implement a Diablo2 Online Game for Web"
```

## 🏔️ Extreme Resilience & Performance

Built for "Infinite Missions," the OpenCode Orchestrator is engineered to handle massive codebases and long-running tasks where absolute stability is non-negotiable.

- **🔄 Continuous Operation (WAL)**: Mission continuity is guaranteed via Write-Ahead Logging. Even after a system crash, the orchestrator "replays" its history from disk to resume complex tasks exactly where they left off.
- **⚡ 80% Resource Efficiency**: Smart intent-based polling and output caching reduce API overhead by 60-80%. The system intelligently filters redundant traffic, ensuring extreme agility even under heavy multi-agent load.
- **🧬 Self-Scaling Intelligence**: Real-time success/failure feedback dynamic concurrency. The system learns model reliability and rate limits on the fly, autonomously balancing execution speed with fail-safe stability.
- **💎 Zero-Leak Architecture**: Rigorous, lifecycle-based resource management ensures 100% memory reclamation. Engineered for sessions lasting 10,000+ iterations without a single byte of memory drift.


## ⭐ Core Philosophy

```
┌───────────────────────────────────────────────────┐
│  🔍 EXPLORE → 📝 LEARN → 🔄 ADAPT → ⚡ ACT         │
│  Scan        Document    Adjust      Execute      │
└───────────────────────────────────────────────────┘
```


## 🚀 The Agents

| Agent | Role | What It Does |
|:------|:-----|:-------------|
| 🎯 **Commander** | Orchestrator | Leads the task, delegates work to other agents, ensures completion |
| 📋 **Planner** | Researcher | Analyzes the project, creates the plan, documents findings |
| 🔨 **Worker** | Implementer | Writes code, modifies files, follows the project's patterns |
| ✅ **Reviewer** | Verifier | Tests changes, checks for errors, confirms quality |



## 📖 Principles

| Principle | What It Means |
|:----------|:--------------|
| 🔍 **Never Assume** | Always check the actual code and config files first |
| 📝 **Document Everything** | Record patterns and findings for future tasks |
| 📚 **Verify with Evidence** | Run tests, cite sources, complete with proof |
| 🔄 **Adapt to the Project** | Match the project's existing style and patterns |
| 🤝 **Specialized Roles** | Each agent has a clear, focused responsibility |


## 🏛️ Workflow Architecture

```
        /task "Build REST API"
                │
    ╔═══════════════════════════════════╗
    ║  🎯 COMMANDER — "Start the task"  ║
    ╚═══════════════╤═══════════════════╝
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌───────┐      ┌───────┐      ┌───────┐
│PLANNER│      │WORKER │      │WORKER │   ← 🔥 50 PARALLEL
│plan.md│      │auth.ts│      │api.ts │      TASKS CONCURRENTLY
└───────┘      └───────┘      └───────┘
    │               │               │
    └───────────────┼───────────────┘
                    ▼
    ╔═══════════════════════════════════╗
    ║  ✅ REVIEWER — "Verify everything"║
    ╚═══════════════╤═══════════════════╝
                    │
           ┌────────┴────────┐
           │ TODO 100%?      │
           │ Issues = 0?     │
           └────────┬────────┘
             No ↙       ↘ Yes
          ♻️ LOOP      ✅ COMPLETE
```

## Features

| Feature | What It Does |
|:---------|:-------------|
| 🚀 **60-80% Optimization**| Smart polling & output caching for massive speed gains |
| ⚡ **50 Parallel Tasks** | Run up to 50 agents simultaneously |
| 🔄 **Non-Stop Recovery** | WAL-based persistence (resumes tasks after crashes) |
| 🔥 **Multi-File Ops** | Work on different files at the same time |
| 🛡️ **Self-Scaling** | Dynamic concurrency limits based on success/failure |
| 🩹 **Memory Integrity** | Strict resource cleanup prevents leaks in long sessions |
| 🧬 **Adaptive AI** | Agents learn and adapt based on the project |

---


## Error Handling

| Error | What Happens |
|:------|:-------------|
| 💥 Tool crash | Inject recovery prompt and retry |
| 🚦 Rate limit hit | Wait and retry with exponential backoff |
| 📦 Context overflow | Compact the context automatically |
| ⏱️ Session timeout | Resume from the last checkpoint |
| 🔨 Build failure | Fix the issue and retry |


## 📚 Documentation

- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** — Full technical deep-dive


## 🎹 Developer's Words

> [Read the full note →](docs/DEVELOPERS_NOTE.md)


## 📄 License

MIT License. [LICENSE](LICENSE)
