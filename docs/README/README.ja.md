# OpenCode Orchestrator Plugin (JA)

> **[OpenCode](https://opencode.ai)のためのマルチエージェントコラボレーションプラグイン**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

</div>

---

## これは何ですか？

6つのエージェントが協力して、**低性能なモデルでも**信頼性の高いコーディングチームに変貌させるシステムです。

**コアアイデア**: 複雑なタスクを原子単位に分解し、すべてのステップを検証し、エラーを自動的に修正します。

---

## なぜオーケストレーターなのか？

| 従来の方法 | オーケストレーター方式 |
|------------|------------------------|
| 大きなプロンプト1つ → うまくいくことを祈る | 原子的タスク → 全ステップ検証済み |
| 高価なモデルが必須 | 固定された安価なモデルでも動作 |
| エラーが静かに蓄積する | 自己修復ループ (Self-correcting) |
| 予測不可能な結果 | **徹底的な実行戦略 (Relentless Strategy)** |

---

- **🧩 並列DAGオーケストレーション** — 独立したタスクの同時実行
- **🎯 固定モデル最適化** — 低性能LLMでも高い信頼性を確保
- **🦀 Rustコア** — 高速でメモリ安全なネイティブ検索・分析ツール
- **🧠 マイクロタスク 2.0** — JSONベースの原子的なタスク分解
- **🛡️ スタイルガーディアン** — 厳格なASTベースのリンティングと整合性チェック
- **🔄 自己修復ループ** — 複雑なエラーに対する自律的なピボット戦略
- **🏘️ インテリジェントグルーピング** — すべてのタスクにCoder + Reviewerのペアリング
- **🏗️ Rustベースのパフォーマンス** — 重い処理のための高性能ネイティブバイナリ

---

## 仕組み (並列DAG)

線形な順序の代わりに、**有向非巡回グラフ (DAG)** を使用してミッションをモデル化します。

```
      ミッション開始 (/dag)
              │
              ▼
      ┌───────────────┐
      │   PLANNER     │ (設計者)
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │ (並列ストリーム)
      ▼               ▼
 ┌───────────┐   ┌───────────┐
 │ タスク (A) │   │ タスク (B) │
 └─────┬─────┘   └─────┬─────┘
       │               │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │   REVIEWER    │ (スタイルガーディアン)
       └───────┬───────┘
               ▼
           ✅ ミッション完了
```

---

## インストール方法

**npm** または **bun** を使用できます。コアロジックはネイティブの **Rustバイナリ** で実行されるため、どちらも同様に動作します。

### 方法 1: npm (標準)
```bash
npm install -g opencode-orchestrator
```

### 方法 2: Bun (高速)
```bash
bun install -g opencode-orchestrator
```

> **注意**: インストール後、**OpenCodeを再起動**するか、ターミナルで `opencode` を実行してください。
> プラグインは `~/.config/opencode/opencode.json` に絶対パスとともに自動的に登録されます。

### トラブルシューティング
`/dag` コマンドが表示されない場合:
1. 削除: `npm uninstall -g opencode-orchestrator` (または `bun remove -g`)
2. 設定クリア: `rm -rf ~/.config/opencode` (警告: すべてのプラグイン設定がリセットされます)
3. 再インストール: `npm install -g opencode-orchestrator`

---

**必要なコマンドはこれだけです:**

```bash
/dag "JWTを使用したユーザー認証を実装して"
```

オーケストレーターが実行すること:
1. **分解 (Decompose)**: ミッションをJSONタスクDAGに分解
2. **並列実行 (Parallel Execute)**: 独立したストリームを同時に実行
3. **検索 (Search)**: コードパターンを積極的に探索
4. **コーディング (Code)**:原子的な精度でコードを作成
5. **検証 (Verify)**: スタイルガーディアンによる必須検証
6. **自己修復 (Self-Heal)**: エラーが発生した場合に自動修正

---

## エージェント構成

| エージェント | 役割 |
|--------------|------|
| **Orchestrator** | チームリーダー — 調整、決定、戦略修正 |
| **Planner** | 作業を原子的な単位に分解 |
| **Coder** | 一度に1つのタスクを実装 |
| **Reviewer** | 品質ゲート — すべてのエラーと同期を監視 |
| **Fixer** | 目標を絞ったエラー修正 |
| **Searcher** | コーディング前のコンテキストとパターンの探索 |

---

- [アーキテクチャ詳細](docs/ARCHITECTURE.md) — DAGの仕組み
- [設定ガイド](../../examples/orchestrator.jsonc) — 設定のカスタマイズ

---

## オープンソース

MITライセンス。テレメトリなし。バックドアなし。

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## 著者の一言

> 私の目標は、適切な構造さえあれば、**普及型モデル**でも高価なAPIと同じくらい素晴らしい結果を出せることを証明することです。
>
> 作業を細かく分割し、すべてのステップを検証し、エラーを自動的に修正する。モデルが賢い必要はありません。プロセスが完璧であればいいのです。
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## ライセンス

MIT License. NO WARRANTY.

[MIT](../../LICENSE)

---

## 🏛️ プロジェクト哲学: 徹底的な実行 (Relentless Execution)

私たちは「速い」AIよりも**「正確な」**AIを信じています。私たちのエージェントは粘り強いです。エラーが発生しても止まらず、戦略を修正し、再計画し、目標が達成されるまで岩を押し続けます。

### 5段階ミッションワークフロー

1.  **🧠 フェーズ 1: 深層分析 (Think First)**: 闇雲にコーディングしません。エージェントはまずドキュメントを読み、プロジェクトの核心となる境界線を要約します。
2.  **🌲 フェーズ 2: 接層的計画 (Hierarchical Planning)**: 上位のアーキテクチャビジョンから、下位の原子的マイクロタスク(JSON DAG)へと業務を分解します。
3.  **👥 フェーズ 3: 並列実行 (Parallel Execution)**: 効率を最大化するために、独立したタスクを同時に実行します。
4.  **🛡️ フェーズ 4: グローバルシンクゲート (Global Sync Gate)**: 並列ストリームが合流した後、すべてのファイル間のインポート/エクスポートおよびロジックの整合性を最終検証します。
5.  **⏳ フェーズ 5: 徹底的な完了 (Relentless Completion)**: 人為的な時間制限は設けません。100%検証された「PASS」だけが成功の基準です。完璧になるまで実行し続けます。

---

## ⚡ 高速な開発速度

このプロジェクトは**非常に速く**進化しています。あなたのワークフローに完璧な実行力をもたらすために、日々繰り返し改善されています。
アップデートが頻繁に行われるため、常に最新バージョンを維持してください。
