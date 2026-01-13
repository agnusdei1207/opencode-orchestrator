# OpenCode 오케스트레이터 플러그인 (KO)

> **[OpenCode](https://opencode.ai)를 위한 멀티 에이전트 협업 플러그인**

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

> **궁극의 목표**
>
> 해결하기 쉬운 아주 작은 단위로 업무를 쪼개서, **바보라도 수행할 수 있게 만들고**, 이를 통해 **병렬로 협업할 수 있게 하는 것**입니다. 모델이 똑똑할 필요는 없습니다. **협력하는 방식이 완벽하면 됩니다.**

---

## 이것은 무엇인가요?

6개의 에이전트가 협업하여 **에이전트 오케스트레이션**을 극대화함으로써, **보급형 저성능 모델**에서도 **궁극의 결정 품질(Ultimate Decision Quality)**을 이끌어내는 시스템입니다.

**핵심 아이디어**: 전략적인 역할 배치, 업무의 마이크로 단위 분해, 그리고 엄격한 검증 규칙 강제를 통해 **저렴한 모델**의 비용으로 **최고급 모델**의 성취를 달성합니다. 모델의 자체 성능이 최상급이 아니더라도, 우리의 아키텍처는 반드시 **훌륭한 결과**를 해내고야 맙니다.

---

## 왜 오케스트레이터인가요?

| 기존 방식 | 오케스트레이터 사용 시 |
|-------------|-------------------|
| 비싼 "똑똑한" 모델 필수 | **보급형 모델 + 똑똑한 프로세스** |
| 높은 토큰 비용 (방대한 문맥) | **토큰 효율성** (필터링된 문맥) |
| 선형적이고 느린 실행 | **병렬적이고 빠른 실행** |
| 에러가 조용히 누적됨 | **자가 수정 검증 루프** |
| "제발 작동해라" 기도 메타 | **전략적 마이크로 태스킹** |

---

- **🧩 전략적 조직화** — 지능적인 역할 분배를 통한 산출물 극대화
- **📉 토큰 경제 (Token Economy)** — 노이즈를 필터링하여 비용 절감 및 집중력 향상
- **⚡ 병렬 DAG** — 속도와 효율성을 위한 동시 실행
- **PDCA 사이클 준수**: 계획-실행-검토-수정의 엄격한 루프를 통해 품질을 보장합니다.
- **🔍 마이크로 태스킹 (Micro-tasking)**: 환각 방지를 위해 업무를 원자 단위로 분해합니다.
- **🛡️ 스타일 가디언 (Style Guardian)**: Reviewer가 엄격한 AST 기반 린팅 및 일관성 검사를 수행합니다.
- **🔄 자가 치유 (Self-healing)**: 복잡한 오류 발생 시 자율적으로 우회 전략을 수립합니다.
- **분산 인지 시스템**: 단순 챗봇이 아닌, OS 커널처럼 동작하는 인텔리전스 레이어.
- **파일 기반 상태 관리**: 컨텍스트 창에 의존하지 않고, 물리적 파일 시스템을 RAM처럼 활용합니다.
- **🏗️ Rust 코어** — 무거운 작업을 위한 네이티브 성능 네이티브 바이너리

---

## 동작 원리 (병렬 DAG)

선형적인 순서 대신, 우리는 **유향 비순환 그래프 (DAG)**를 사용하여 미션을 모델링합니다.

```
      미션 시작 (/task)
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

- [아키텍처 딥다이브](../ARCHITECTURE.md) — DAG 작동 방식
- [설정 가이드](../../examples/orchestrator.jsonc) — 설정 커스터마이징

---

## 오픈 소스

MIT 라이선스. 텔레메트리 없음. 백도어 없음.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## 라이선스

MIT License. NO WARRANTY.

[MIT](../../LICENSE)

---

## 🏛️ 아키텍처: PDCA 및 분산 인지 루프 (The Architecture)

우리는 더 이상 단순한 "챗봇"의 패러다임을 따르지 않습니다. **OpenCode Orchestrator**는 LLM의 확률적(stochastic) 본질 위에 **PDCA(Plan-Do-Check-Act) 사이클**을 엄격히 따르는 **결정론적 엔지니어링 레이어**를 구현합니다.

우리는 에이전트를 **의미론적 연산 유닛(Semantic Compute Units)**으로 취급합니다. 엄격한 컴퓨터 과학 원리를 적용함으로써, 우리는 단일 모델이 달성할 수 없는 수준의 신뢰성을 확보합니다.

### 🧬 방법론의 "위대한 융합 (Grand Fusion)"
우리는 거대한 세 가지 도메인을 하나의 매끄러운 워크플로우로 융합했습니다:

1.  **PDCA 방법론 (품질 보증)**:
    *   **Plan (Planner)**: 미션을 원자 단위의 태스크로 재귀적으로 분해합니다 ($O(log n)$).
    *   **Do (Coder)**: 원자적 태스크를 병렬로 실행합니다 (분산 작업).
    *   **Check (Reviewer)**: **비잔틴 장애 허용(Byzantine Fault Tolerance)** 노드로서, 요구사항에 대해 코드를 엄격히 검증합니다.
    *   **Act (Orchestrator)**: 성공적인 상태를 병합하거나, 실패 시 **피봇(Dynamic Programming)**합니다.

2.  **분산 시스템 이론 (액터 모델)**:
    *   각 에이전트는 독립적인 상태를 가진 **액터(Actor)**로 동작합니다.
    *   **컨텍스트 샤딩**: 컨텍스트 윈도우를 RAM처럼 취급하며, 데이터를 `temp_context` 파일로 페이징(Page Swapping)하여 **무한 컨텍스트**를 시뮬레이션합니다.

3.  **알고리즘 효율성**:
    *   **분할 정복 (Divide & Conquer)**: 복잡한 문제를 사소한 $O(1)$ 하위 문제로 쪼갭니다.
    *   **동적 계획법 (Dynamic Programming)**: 중간 결과(State)를 저장하여 중복 계산을 피하고 지능적인 역추적(Backtracking)을 허용합니다.

### 🚀 명령어: `/task`

이 시스템을 제어하는 인터페이스는 강력한 단 하나의 명령어입니다:

```bash
/task "인증 미들웨어를 리팩토링하고 JWT 로테이션을 구현해줘"
```

이것은 **"분산 태스크 루프(Distributed Task Loop)"**를 트리거합니다. 이것은 단순한 채팅이 아닙니다. 미션에 대한 약속(Commitment)입니다.

### 5단계 효율성 워크플로우

1.  **🧠 1단계: 필터링된 분석**: **Searcher**는 문서를 읽되 노이즈를 걸러냅니다. 오직 "임계 경로(critical path)"만 Planner에게 전달합니다.
2.  **🌲 2단계: 전략적 계획**: **Planner**는 JSON DAG를 생성합니다. 이것이 우리의 로드맵입니다. 정처 없이 헤매는 데 낭비되는 토큰은 없습니다.
3.  **🚀 3단계: 병렬 실행**: **Orchestrator**는 독립적인 태스크를 식별하고 동시에 실행합니다.
4.  **🛡️ 4단계: 동기화 및 검증**: **Reviewer**는 문지기 역할을 합니다. 문법, 로직, 그리고 *파일 간 일관성*을 검사합니다.
5.  **💰 5단계: 가성비 완수**: "주니어 인턴"의 가격으로 "시니어 개발자"의 결과를 얻습니다.

---

## ⚡ 빠른 개발 속도

이 프로젝트는 **매우 빠르게** 진화하고 있습니다. 여러분의 워크플로우에 완벽한 실행력을 제공하기 위해 매일 반복 개선됩니다.
업데이트가 잦으므로 항상 최신 버전을 유지해 주세요.
