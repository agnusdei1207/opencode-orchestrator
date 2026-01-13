# OpenCode 编排器插件 (ZH)

> **[OpenCode](https://opencode.ai) 的多智能体协同系统**

<div align="center">
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md)
</div>

---

## 这是什么？

一个由 6 个智能体组成的协作系统，能将任何大语言模型 (LLM) 转化为可靠的代码开发团队。

**核心理念**：将复杂任务分解为原子单位，验证每一步，并自动修复错误。

---

## 为什么选择编排器？

| 传统方式 | 使用编排器 |
|----------|------------|
| 一个巨大的提示词 → 祈祷它能工作 | 原子级任务 → 每一步都经过验证 |
| 必须使用昂贵的模型 | 固定且平价的模型即可胜任 |
| 错误静默累积 | 自我修复循环 (Self-healing) |
| 结果不可预测 | **终极执行策略 (Relentless Strategy)** |

---

- **🧩 并行 DAG 编排** — 并发执行独立任务
- **🎯 固定模型优化** — 即使使用低性能 LLM 也能保证高可靠性
- **🦀 Rust 核心** — 快速、内存安全的原生搜索与分析工具
- **🧠 微任务 2.0** — 基于 JSON 的原子级任务分解
- **🛡️ 风格守护者** — 严格的基于 AST 的代码检查一致性校验
- **🔄 自我修复循环** — 针对复杂错误的自主调整 (Pivot) 策略
- **🏘️ 智能分组** — 为每个任务配备 Coder + Reviewer 组合
- **🏗️ Rust 驱动性能** — 原生性能处理重度计算任务

---

## 工作流程 (并行 DAG)

我们不采用线性顺序，而是使用 **有向无环图 (DAG)** 来构建您的任务模型。

```
      任务开始 (/dag)
              │
              ▼
      ┌───────────────┐
      │   PLANNER     │ (架构师)
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │ (并行流)
      ▼               ▼
 ┌───────────┐   ┌───────────┐
 │ 任务组 (A) │   │ 任务组 (B) │
 └─────┬─────┘   └─────┬─────┘
       │               │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │   REVIEWER    │ (风格守护者)
       └───────┬───────┘
               ▼
           ✅ 任务完成
```

---

## 安装指南

支持使用 **npm** 或 **bun**。由于核心逻辑运行在原生的 **Rust 二进制文件**中，两者效果一致。

### 选项 1：npm (标准)
```bash
npm install -g opencode-orchestrator
```

### 选项 2：Bun (快速)
```bash
bun install -g opencode-orchestrator
```

> **注意**：安装后请 **重启 OpenCode** 或在终端运行 `opencode`。
> 插件将自动以绝对路径注册到 `~/.config/opencode/opencode.json`。

### 疑难解答
如果 `/dag` 命令未出现：
1. 卸载：`npm uninstall -g opencode-orchestrator`
2. 清除配置：`rm -rf ~/.config/opencode` (警告：这将重置所有插件)
3. 重新安装：`npm install -g opencode-orchestrator`

---

**您唯一需要的命令：**

```bash
/dag "实现基于 JWT 的用户认证功能"
```

编排器将：
1. **分解 (Decompose)**：将任务分解为 JSON 任务 DAG
2. **并行执行 (Parallel Execute)**：并发处理独立的工作流
3. **搜索 (Search)**：主动探索代码模式
4. **编码 (Code)**：以原子级的精度编写代码
5. **验证 (Verify)**：通过风格守护者进行强制验证
6. **自修复 (Self-Heal)**：遇到错误时自动修复

---

## 智能体角色

| 智能体 | 角色 |
|--------|------|
| **Orchestrator** | 团队领导 — 协调、决策与策略调整 |
| **Planner** | 将工作分解为原子级任务 |
| **Coder** | 每次执行一个原子任务 |
| **Reviewer** | 质量门控 — 捕捉所有错误与同步问题 |
| **Fixer** | 针对性的错误修复 |
| **Searcher** | 编码前的上下文与模式探索 |

---

- [架构深度解析](docs/ARCHITECTURE.md) — DAG 工作原理
- [配置说明](examples/orchestrator.jsonc) — 自定义设置

---

## 开源协议

MIT 协议。无遥测。无后门。

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## 作者寄语

> 我的目标是证明，只要结构正确，像 **GLM-4.7** 这样平价的模型也能产出与昂贵 API 相当的结果。
>
> 分解任务，验证每一步，自动修复错误。模型不需要太聪明，流程必须足够严谨。
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## 许可证

MIT License. NO WARRANTY.

---

## 🏛️ 项目哲学：终极执行 (Relentless Execution)

我们不相信“快速”的 AI，我们相信 **“正确”** 的 AI。我们的智能体永不言弃。在遇到错误时它们不会停止，而是会调整策略、重新规划并继续推进，直到目标完美达成。

### mission 5 阶段工作流

1.  **🧠 阶段 1：深度分析 (先思考)**：拒绝盲目编码。智能体必须首先阅读文档，总结项目的核心边界。
2.  **🌲 阶段 2：层级规划 (Hierarchical Planning)**：从宏观架构愿景分解到微观原子任务 (JSON DAG)。
3.  **👥 阶段 3：并行执行 (Parallel Execution)**：并发执行独立任务，最大化效率。
4.  **🛡️ 阶段 4：全局同步门控 (Global Sync Gate)**：并行流合并后，进行 **全局一致性检查**，确保所有文件、导入和导出保持完美同步。
5.  **⏳ 阶段 5：终极交付 (Relentless Completion)**：不设人为时间限制。成功只有唯一标准：100% 通过验证的 PASS。任务将一直执行到完美为止。

---

## ⚡ 快速迭代

本项目正处于 **极速进化** 中。我们通过不断的迭代为您的工作流带来终极执行力。
更新频繁，请保持版本最新。
