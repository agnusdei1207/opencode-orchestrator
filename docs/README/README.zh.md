# OpenCode 编排器插件 (ZH)

> **[OpenCode](https://opencode.ai) 的多智能体协同系统**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

---

<p align="center">
  <img src="../../assets/logo.png" width="600" />
</p>

> **终极目标**
>
> 将任务分解为极小的、易于解决的单元，以至于**即使是‘傻瓜’也能执行**，从而实现**大规模并行协作**。模型不需要很聪明。**协作方式必须是完美的。**

---

## 这是什么？

一个由 6 个智能体组成的协作系统，通过最大化 **智能体编排 (Agent Orchestration)**，从 **平价、低性能模型** 中提取 **极致决策质量 (Ultimate Decision Quality)**。

**核心理念**：通过战略性的角色分配、微观任务分解和严格的验证规则强制，我们以 **“廉价模型”的成本** 实现了 **“昂贵模型”的结果**。即使基础性能不是最顶级的，我们的架构也能确保 **完美达成** 目标。

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
- **遵循 PDCA 循环**: 通过计划-执行-检查-行动的严格循环来保证质量。
- **🔍 微任务化 (Micro-tasking)**: 原子级任务分解以防止幻觉。
- **🛡️ 风格守卫 (Style Guardian)**: Reviewer 执行严格的基于 AST 的 Lint 和一致性检查。
- **🔄 自愈 (Self-healing)**: 针对复杂错误的自主规避与修复策略。
- **分布式认知系统**: 不是简单的聊天机器人，而是像 OS 内核一样运行的智能层。
- **基于文件的状态管理**: 不依赖上下文窗口，利用物理文件系统作为 RAM。针对复杂错误的自主规避策略
- **🏗️ Rust 核心** — 用于繁重任务的原生性能处理重度计算任务

---

## 工作流程 (并行 DAG)

我们不采用线性顺序，而是使用 **有向无环图 (DAG)** 来构建您的任务模型。

```
      任务开始 (/task)
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

## 许可证

MIT License. NO WARRANTY.

[MIT](../../LICENSE)

---

## 🏛️ 架构：PDCA 与分布式认知循环 (The Architecture)

我们已经超越了简单“聊天机器人”的范式。**OpenCode Orchestrator** 在大语言模型的随机性之上，实施了一个严格遵循 **PDCA (计划-执行-检查-行动)** 循环的 **确定性工程层**。

我们将智能体视为 **语义计算单元 (Semantic Compute Units)**。通过应用严谨的计算机科学原则，我们达到了单一模型无法匹敌的可靠性水平。

### 🧬 方法论的“宏大融合 (Grand Fusion)”
我们将三个巨大的领域显式地融合到一个无缝的工作流中：

1.  **PDCA 方法论 (质量保证)**:
    *   **Plan (Planner)**: 将任务递归分解为原子任务 ($O(log n)$)。
    *   **Do (Coder)**: 并行执行原子任务 (分布式行动)。
    *   **Check (Reviewer)**: 作为 **拜占庭容错 (Byzantine Fault Tolerance)** 节点，严格根据需求验证代码。
    *   **Act (Orchestrator)**: 合并成功状态，或在失败时 **转向 (Pivot)**（动态规划）。

2.  **分布式系统理论 (Actor 模型)**:
    *   每个智能体作为具有隔离状态的独立 **Actor** 运行。
    *   **上下文分片**: 我们将上下文窗口视为 RAM，通过 `temp_context` 文件换入/换出数据 (分页交换) 以模拟 **无限上下文**。

3.  **算法效率**:
    *   **分治法 (Divide & Conquer)**: 将复杂问题分解为微不足道的 $O(1)$ 子问题。
    *   **动态规划 (Dynamic Programming)**: 存储中间结果 (状态) 以避免重复计算并允许智能回溯。

### 🚀 命令：`/task`

该系统的接口是一个单一、强大的命令：

```bash
/task "重构身份验证中间件并实现 JWT 轮换"
```

这触发了 **分布式任务循环 (Distributed Task Loop)**。这不仅仅是一个聊天； 这是一个任务承诺。**Reviewer** 智能体的存在完全是为了捕捉这些错误。我们用少量的计算时间换取 100% 的可靠性。

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
