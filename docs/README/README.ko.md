# OpenCode 오케스트레이터 플러그인 (KO)

> **[OpenCode](https://opencode.ai)를 위한 멀티 에이전트 협업 플러그인**

<div align="center">

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](../../LICENSE)
[![npm](https://img.shields.io/npm/v/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![npm downloads](https://img.shields.io/npm/dt/@agnusdei1207/opencode-orchestrator.svg)](https://www.npmjs.com/package/@agnusdei1207/opencode-orchestrator)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-purple.svg)](https://opencode.ai)

[English](../../README.md) | [한국어](README.ko.md) | [简体中文](README.zh.md) | [日本語](README.ja.md) | [Español](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)
[Русский](README.ru.md) | [Português](README.pt.md)

</div>

---

## 이것은 무엇인가요?

6개의 에이전트가 협업하여 **에이전트 오케스트레이션**을 극대화함으로써, **보급형 저성능 모델**에서도 **궁극의 결정 품질(Ultimate Decision Quality)**을 이끌어내는 시스템입니다.

**핵심 아이디어**: 전략적인 역할 배치, 업무의 마이크로 단위 분해, 엄격한 검증 규칙 강제를 통해 "저렴한 모델" 비용으로 "비싼 모델"의 결과를 달성합니다.

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
- **🔍 마이크로 태스킹** — 환각 방지를 위한 원자 단위 업무 분해
- **🛡️ 스타일 가디언** — 엄격한 AST 기반 린팅 및 일관성 검사
- **🔄 자가 치유** — 복잡한 오류에 대한 자율적인 우회 전략
- **🏗️ Rust 코어** — 무거운 작업을 위한 네이티브 성능 네이티브 바이너리

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

- [아키텍처 딥다이브](../ARCHITECTURE.md) — DAG 작동 방식
- [설정 가이드](../../examples/orchestrator.jsonc) — 설정 커스터마이징

---

## 오픈 소스

MIT 라이선스. 텔레메트리 없음. 백도어 없음.

[github.com/agnusdei1207/opencode-orchestrator](https://github.com/agnusdei1207/opencode-orchestrator)

---

## 저자의 한 마디

> 저의 목표는 올바른 구조만 갖춰진다면 **보급형 모델**도 비싼 API만큼 훌륭한 결과를 낼 수 있음을 증명하는 것입니다.
>
> 작업을 잘게 쪼개고, 모든 단계를 검증하며, 에러를 자동으로 수정하세요. 모델이 똑똑할 필요는 없습니다. 절차가 완벽하면 됩니다.
>
> — [@agnusdei1207](https://github.com/agnusdei1207)

---

## 라이선스

MIT License. NO WARRANTY.

[MIT](../../LICENSE)

---

## 🏛️ 프로젝트 철학: 아키텍처의 위대한 융합 (Grand Fusion)

이 프로젝트는 **컴퓨터 과학의 정수(Greatest Hits)를 집대성한 교향곡**입니다. 이는 단순한 챗봇 스크립트가 아니며, 고급 알고리즘과 아키텍처 패턴이 완벽하게 **협업(Collaboration)**하는 융합체입니다.

우리는 **운영체제 커널 원리(스케줄링), 분산 컴퓨팅(상태 샤딩), 그리고 알고리즘 효율성(분할 정복, 동적 계획법)**을 하나로 통합하여 이 시스템을 설계했습니다. 이러한 강력한 컴퓨터 공학적 개념들을 **오케스트레이션**함으로써, 모델 개개의 한계를 **아키텍처적 우월성(Architectural Superiority)**으로 극복합니다.

우리는 에이전트 오케스트레이션을 **분산 컴퓨팅 문제**로 다루며, 저비용 모델에서도 극한의 지능을 짜냅니다.

### 핵심 엔지니어링 원칙

1.  **DAG (Directed Acyclic Graph)**: 미션을 선형적인 대화가 아닌, 의존성 그래프로 모델링합니다. 이는 독립적인 태스크의 비차단(Non-blocking) 비동기 실행을 가능하게 합니다.
2.  **분할 정복 (Divide & Conquer)**: **Planner**는 재귀적 분해를 통해 복잡한 문제를 원자 단위의 해결 가능한 단위(Coder에게는 $O(1)$ 난이도)로 쪼갭니다.
3.  **상태 및 스케줄 관리**: 전용 Orchestrator가 **커널 스케줄러**처럼 동작하여 스레드 상태(Ready, Running, Success, Failed)를 관리하고, 분리된 실행 노드 간의 컨텍스트를 지속(File I/O)시킵니다.
4.  **병렬 처리 (Parallel Processing)**: 여러 에이전트가 동시에 서로 다른 파일에서 작업합니다. 우리는 스레드 동시성을 실시간 속도와 교환합니다.
5.  **동적 적응 (Dynamic Adaptation)**: 경로가 실패하면 단순히 재시도하지 않고, **피봇(Pivot)**하여 계획을 동적으로 수정합니다.

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
