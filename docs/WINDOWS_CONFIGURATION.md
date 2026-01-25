# Windows Configuration Guide

This guide explains how to properly configure **OpenCode Orchestrator** on Windows.

## ⚠️ Important: Configuration Location

A common mistake on Windows is placing the configuration file in your user home directory (e.g., `C:\Users\Name\.opencode\agents.json`).

**OpenCode Orchestrator only supports PROJECT-LEVEL configuration.**

You must place your configuration file inside the root directory of the specific project you are working on.

### ✅ Correct Path
If your project is located at `C:\Projects\MyApp`, the configuration must be at:
```text
C:\Projects\MyApp\.opencode\agents.json
```

### ❌ Incorrect Path (Global/Home)
The following path is **NOT** read by the orchestrator:
```text
C:\Users\YourName\.opencode\agents.json
```

---

## 📄 agents.json Template

Create a file named `agents.json` in your project's `.opencode` folder with the following structure. This allows you to define custom agents or overrides.

```json
{
  "optimizer": {
    "id": "optimizer",
    "description": "Optimizes code performance and resource usage",
    "systemPrompt": "You are an optimization expert. Analyze the code for bottlenecks and inefficient algorithms.",
    "canWrite": true,
    "canBash": false
  },
  "security-auditor": {
    "id": "security-auditor",
    "description": "Scans for security vulnerabilities",
    "systemPrompt": "You are a security auditor. Focus on identifying OWASP top 10 vulnerabilities.",
    "canWrite": false,
    "canBash": true
  }
}
```

## Troubleshooting

### 1. "Model changes not picking up"
If you edit `agents.json` and don't see changes:
1.  **Restart the Orchestrator**: The configuration is loaded once at startup. You must restart the agent/CLI for changes to take effect.
2.  **Verify Location**: Ensure the file is in `.opencode\` folder *inside your current working directory*.
3.  **Check JSON Syntax**: Ensure the file is valid JSON. Trailing commas or missing quotes will cause the load to fail silently (logs may show an error).

### 2. File Permissions
Ensure your Windows user has **Read** access to the `.opencode` directory and `agents.json` file.

## Cross-Platform Note
This project-level configuration behavior is consistent across Windows, macOS, and Linux. We prioritize project-scoped configuration to ensure that agent behaviors travel with the codebase (via Git) rather than depending on a developer's local machine environment.
