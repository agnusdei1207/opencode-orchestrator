# OpenCode 编排器插件 (ZH)

> **[OpenCode](https://opencode.ai) 的多智能体协同系统**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

</div>

---

## 这是什么？

一个由 6 个智能体组成的协作系统，通过最大化 **智能体编排 (Agent Orchestration)**，从 **平价、低性能模型** 中提取 **极致决策质量 (Ultimate Decision Quality)**。

**核心理念**：通过战略性组织角色，将工作分解为微任务，并强制执行严格的验证规则，我们以“预算模型”的成本实现了“昂贵模型”的结果。

---

## 为什么选择 Orchestrator？

| 传统方式 | 使用 Orchestrator |
|-------------|-------------------|
| 需要昂贵的“聪明”模型 | **平价模型 + 聪明流程** |
| 高 Token 成本 (巨大上下文) | **Token 高效** (过滤后的上下文) |
| 线性、缓慢执行 | **并行、快速执行** |
| 错误悄然累积 | **自愈验证循环** |
| “希望它能工作” | **战略性微任务化** |

---

- **🧩 战略性组织** — 通过智能角色分配最大化产出
- **📉 Token 经济** — 过滤噪音以降低成本并提高专注度
- **⚡ 并行 DAG** — 并发执行以提高速度和效率
- **🔍 微任务化** — 原子分解以防止幻觉
- **🛡️ 风格守卫** — 严格的基于 AST 的 Lint 和一致性检查
- **🔄 自愈** — 针对复杂错误的自主规避策略
- **🏗️ Rust 核心** — 用于繁重任务的原生性能处理重度计算任务

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

- [架构深度解析](../ARCHITECTURE.md) — DAG 工作原理
- [配置说明](../../examples/orchestrator.jsonc) — 自定义设置

---

## 开源协议

MIT 协议。无遥测。无后门。

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## 作者寄语

> 我的目标是证明，只要结构正确，像 **平价模型** 也能产出与昂贵 API 相当的结果。
>
> 分解任务，验证每一步，自动修复错误。模型不需要太聪明，流程必须足够严谨。
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## 许可证

MIT License. NO WARRANTY.

[MIT](../../LICENSE)

---

## 🏛️ 项目理念：架构的宏大融合 (Grand Fusion)

本项目是 **计算机科学巅峰之作的交响曲**。它不仅仅是一个聊天机器人脚本；它是高级算法和架构模式的 **协同融合 (Collaborative Fusion)**。

我们通过整合 **操作系统内核原理（调度）、分布式计算（状态分片）和算法效率（分治法、动态规划）** 明确设计了该系统。通过对这些强大的计算机科学概念进行 **编排**，我们通过 **架构优势 (Architectural Superiority)** 克服了单个 AI 模型的局限性。

我们将智能体编排视为一个 **分布式计算问题**，从平价模型中榨取每一分智能。

本项目证明，如果组织得当，**平价、低性能模型**（如本地模型或预算 API）也能达到 **极致决策质量**。我们通过模仿高绩效的人类工程团队来实现这一目标。

### 秘方：极致效率

1.  **微任务化 ("分散" 策略)**：我们不要求模型“建立一个网站”。我们将任务分解为原子性的、20 行左右的变更。小上下文 = 高准确度 = 低幻觉。
2.  **并行执行与验证**：通过并行运行独立任务，我们减少了挂钟时间（wall-clock time）。
3.  **Token 经济**：我们严格过滤上下文。智能体不阅读整个代码库；它们只阅读 *更新* 和 *摘要*。这在保持准确性的同时大幅降低了 Token 成本。
4.  **无情验证**：我们接受廉价模型会犯错的事实。**Reviewer** 智能体的存在完全是为了捕捉这些错误。我们用少量的计算时间换取 100% 的可靠性。

### 5 阶段效率工作流

1.  **🧠 第 1 阶段：过滤分析**：**Searcher** 阅读文档但过滤掉噪音。我们只将“关键路径”提供给 Planner。
2.  **🌲 第 2 阶段：战略规划**：**Planner** 创建 JSON DAG。这是我们的路线图。没有 Token 会浪费在漫无目的的游荡上。
3.  **🚀 第 3 阶段：并行执行**：**Orchestrator** 识别独立任务并并发运行它们。
4.  **🛡️ 第 4 阶段：同步与验证**：**Reviewer** 充当守门人。它检查语法、逻辑以及 *跨文件一致性*。
5.  **💰 第 5 阶段：高性价比完成**：以“初级实习生”的价格获得“高级开发人员”的结果。成功只有唯一标准：100% 通过验证的 PASS。任务将一直执行到完美为止。

---

## ⚡ 快速迭代

本项目正处于 **极速进化** 中。我们通过不断的迭代为您的工作流带来终极执行力。
更新频繁，请保持版本最新。
