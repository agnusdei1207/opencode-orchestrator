# OpenCode 오케스트레이터 플러그인 (KO)

> **[OpenCode](https://opencode.ai)를 위한 멀티 에이전트 협업 플러그인**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md)

</div>

---

## 이것은 무엇인가요?

6개의 에이전트가 협업하여 **저성능 모델(GLM-4.7 등)이라도** 최고의 신뢰성을 가진 코딩 팀으로 변모시키는 시스템입니다.

**핵심 아이디어**: 복잡한 작업을 원자 단위로 분해하고, 모든 단계를 검증하며, 에러를 자동으로 수정합니다.

---

## 왜 오케스트레이터인가요?

| 기존 방식 | 오케스트레이터 방식 |
|-----------|--------------------|
| 하나의 거대한 프롬프트 → 잘 되길 기도함 | 원자적 단위 작업 → 모든 단계 검증 |
| 고성능의 비싼 모델 필수 | 고정된 저렴한 모델로도 최상의 결과 |
| 에러가 조용히 누적됨 | 스스로 치유하는 루프 (Self-correcting) |
| 예측 불가능한 결과 | **끝장 실행 전략 (Relentless Strategy)** |

---

- **🧩 병렬 DAG 오케스트레이션** — 독립적 작업의 동시 실행
- **🎯 고정 모델 최적화** — 저성능 LLM에서도 보장되는 높은 신뢰도
- **🦀 Rust 코어** — 빠르고 안전한 네이티브 검색 및 분석 도구
- **🧠 마이크로 태스크 2.0** — JSON 기반의 정교한 작업 분해
- **🛡️ 스타일 가디언** — 엄격한 AST 기반 린팅 및 일관성 체크
- **🔄 자가 치유 루프** — 복잡한 에러에 대한 자율적 피벗 전략
- **🏘️ 인텔리전트 그룹핑** — 모든 작업에 Coder + Reviewer 페어링
- **🏗️ Rust 기반 성능** — 무거운 작업을 위한 고성능 네이티브 바이너리

---

## 동작 원리 (병렬 DAG)

선형적인 순서 대신, 우리는 **유향 비순환 그래프 (DAG)**를 사용하여 미션을 모델링합니다.

```
      미션 시작 (/dag)
              │
              ▼
      ┌───────────────┐
      │   PLANNER     │ (설계자)
      └───────┬───────┘
              │
      ┌───────┴───────┐
      │               │ (병렬 스트림)
      ▼               ▼
 ┌───────────┐   ┌───────────┐
 │ 작업 세트 (A) │   │ 작업 세트 (B) │
 └─────┬─────┘   └─────┬─────┘
       │               │
       └───────┬───────┘
               ▼
       ┌───────────────┐
       │   REVIEWER    │ (스타일 가디언)
       └───────┬───────┘
               ▼
           ✅ 미션 완료
```

---

## 설치 방법

**npm** 또는 **bun**을 사용할 수 있습니다. 코어 로직은 네이티브 **Rust 바이너리**에서 실행되므로 두 방식 모두 동일하게 작동합니다.

### 방법 1: npm (표준)
```bash
npm install -g opencode-orchestrator
```

### 방법 2: Bun (빠름)
```bash
bun install -g opencode-orchestrator
```

> **참고**: 설치 후 **OpenCode를 재시작**하거나 터미널에서 `opencode`를 실행하세요.
> 플러그인은 절대 경로와 함께 `~/.config/opencode/opencode.json`에 자동으로 등록됩니다.

### 문제 해결
`/dag` 명령어가 나타나지 않는 경우:
1. 삭제: `npm uninstall -g opencode-orchestrator`
2. 설정 초기화: `rm -rf ~/.config/opencode` (경고: 모든 플러그인 설정이 초기화됨)
3. 재설치: `npm install -g opencode-orchestrator`

---

**필요한 명령어는 단 하나입니다:**

```bash
/dag "JWT를 사용한 사용자 인증 기능을 구현해줘"
```

오케스트레이터의 수행 단계:
1. **분해(Decompose)**: 미션을 JSON 작업 DAG로 분해
2. **병렬 실행(Parallel Execute)**: 독립적인 작업들을 동시에 실행
3. **검색(Search)**: 코드 패턴을 선제적으로 탐색
4. **코딩(Code)**: 원자적 정밀도로 코드 작성
5. **검증(Verify)**: 스타일 가디언을 통한 필수 검증
6. **자가 치유(Self-Heal)**: 에러 발생 시 자동 수정

---

## 에이전트 구성

| 에이전트 | 역할 |
|----------|------|
| **Orchestrator** | 팀 리더 — 전체 조율, 결정 및 전략 수정 |
| **Planner** | 작업을 원자적 단위로 세분화 |
| **Coder** | 한 번에 하나의 원자적 작업 구현 |
| **Reviewer** | 품질 게이트 — 모든 에러 및 싱크 감시 |
| **Fixer** | 타겟팅된 에러 수정 수행 |
| **Searcher** | 코딩 전 맥락 및 패턴 탐색 |

---

- [아키텍처 딥다이브](docs/ARCHITECTURE.md) — DAG 작동 방식
- [설정 가이드](examples/orchestrator.jsonc) — 설정 커스터마이징

---

## 오픈 소스

MIT 라이선스. 텔레메트리 없음. 백도어 없음.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## 저자의 한 마디

> 저의 목표는 올바른 구조만 갖춰진다면 **GLM-4.7과 같은 보급형 모델**도 비싼 API만큼 훌륭한 결과를 낼 수 있음을 증명하는 것입니다.
>
> 작업을 잘게 쪼개고, 모든 단계를 검증하며, 에러를 자동으로 수정하세요. 모델이 똑똑할 필요는 없습니다. 절차가 완벽하면 됩니다.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## 라이선스

MIT License. NO WARRANTY.

---

## 🏛️ 프로젝트 철학: 끝장 실행 (Relentless Execution)

우리는 "빠른" AI보다 **"정확한"** AI를 믿습니다. 우리의 에이전트들은 끈질깁니다. 에러가 발생해도 멈추지 않고, 전략을 수정하고 다시 계획하며 목표가 달성될 때까지 바위를 밀어 올립니다.

### 5단계 미션 워크플로우

1.  **🧠 Phase 1: 심층 분석 (Think First)**: 무작정 코딩하지 않습니다. 먼저 문서를 읽고 프로젝트의 핵심 경계와 요약을 수행합니다.
2.  **🌲 Phase 2: 계층적 계획 (Hierarchical Planning)**: 상위 아키텍처 비전에서 하위 원자적 마이크로 태스크(JSON DAG)로 업무를 분해합니다.
3.  **👥 Phase 3: 병렬 실행 (Parallel Execution)**: 효율을 극대화하기 위해 독립적인 작업들을 동시에 수행합니다.
4.  **🛡️ Phase 4: 글로벌 싱크 게이트 (Global Sync Gate)**: 병렬 스트림이 합쳐진 후, 전체 파일 간의 임포트/익스포트 및 로직 일관성을 최종 검증합니다.
5.  **⏳ Phase 5: 끝장 실행 (Relentless Completion)**: 인위적인 시간 제한을 두지 않습니다. 오직 100% 검증된 'PASS'만이 성공의 기준입니다. 완벽해질 때까지 계속합니다.

---

## ⚡ 빠른 개발 속도

이 프로젝트는 **매우 빠르게** 진화하고 있습니다. 여러분의 워크플로우에 완벽한 실행력을 제공하기 위해 매일 반복 개선됩니다.
업데이트가 잦으므로 항상 최신 버전을 유지해 주세요.
