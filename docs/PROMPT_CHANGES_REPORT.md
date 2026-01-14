# 프롬프트 수정 보고서

## 📋 요약

**"최소 수정(Minimal Modification)"** 철학과 **"FIXED/MODIFIABLE Zone"** 개념을 에이전트 프롬프트에 적용했습니다.

---

## 🔧 수정된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `crates/orchestrator-core/src/agents/prompts.rs` | 6개 에이전트 프롬프트에 규칙 추가 |
| `crates/orchestrator-core/src/agents/definition.rs` | `RuntimeContext` 구조체 추가 |

---

## 🆕 핵심 신규 기능: FIXED/MODIFIABLE Zone

**모든 에이전트가 작업 전 README.md 등 문서를 읽고:**
1. **FIXED ZONES** 식별: 절대 변경 금지 영역 (기술 스택, 핵심 아키텍처)
2. **MODIFIABLE ZONES** 식별: 변경 가능한 영역
3. 이 정보를 **메모하고 미션 전체에서 유지**

```
## CORE PRINCIPLE: MINIMAL MODIFICATION
- Always achieve goals with the LEAST amount of change.
- Only do what the user explicitly requested. No unrelated work.
{{ ... }}
```

---

## 📝 변경 상세

### 1. ORCHESTRATOR 프롬프트 (팀 리더)

**추가된 섹션: `CORE PRINCIPLE: MINIMAL MODIFICATION`**

```
## CORE PRINCIPLE: MINIMAL MODIFICATION
- Always achieve goals with the LEAST amount of change.
- Only do what the user explicitly requested. No unrelated work.
- Preserve existing tech stack. No language/framework conversion without approval.
- Edit existing files before creating new ones.
- Creating files IS allowed for: readability, proper structure, separation of concerns.
```

**한글 해석:**
- 항상 최소한의 변경으로 목표 달성
- 사용자가 명시적으로 요청한 것만 수행. 관련 없는 작업 금지.
- 기존 기술 스택 보존. 승인 없이 언어/프레임워크 변환 금지.
- 새 파일 생성보다 기존 파일 수정 우선.
- 가독성, 적절한 구조, 관심사 분리를 위한 파일 생성은 허용.

**Operational SOP 변경:**
- `PHASE 0`이 "기술 스택 먼저 파악"으로 변경됨

**Safety & Boundary SOP 추가:**
- `Stack Guard: NEVER convert between languages/frameworks.`

**🆕 Agent Delegation with Dynamic Context 추가:**
Orchestrator가 각 에이전트 호출 시 동적 컨텍스트를 주입하도록 가이드라인 추가:

| 에이전트 | 주입할 컨텍스트 |
|----------|---------------|
| SEARCHER | 환경 정보, 검색 대상, "FIXED zones 찾기" |
| PLANNER | 환경 정보, FIXED/MODIFIABLE zones, 원래 요청 |
| CODER | 환경 정보, FIXED zones, 현재 태스크, 의존성 컨텍스트 |
| REVIEWER | FIXED zones, 현재 태스크 범위 |
| FIXER | 환경 정보, FIXED zones, 정확한 에러 메시지 |

---

## 🆕 신규: RuntimeContext 구조체 (코드 레벨)

**파일**: `crates/orchestrator-core/src/agents/definition.rs`

**새 구조체 추가**: `RuntimeContext`

```rust
pub struct RuntimeContext {
    pub environment: Option<String>,        // OS, Docker/local 정보
    pub fixed_zones: Vec<String>,           // 변경 금지 영역
    pub modifiable_zones: Vec<String>,      // 변경 가능 영역
    pub current_task: Option<String>,       // 현재 태스크
    pub dependencies_context: Option<String>, // 의존성 컨텍스트
    pub additional_instructions: Option<String>, // 추가 지시사항
    pub error_context: Option<String>,      // 에러 컨텍스트 (Fixer용)
}
```

**사용법**:
```rust
let context = RuntimeContext::new()
    .with_environment("macOS, Docker compose")
    .with_fixed_zones(vec!["crates/".into(), "Cargo.toml".into()])
    .with_task("Implement login feature")
    .with_instructions("Match existing code style");

agent.set_context(context);
let full_prompt = agent.full_prompt(); // 시스템 프롬프트 + 런타임 컨텍스트
```

---

### 2. PLANNER 프롬프트 (설계자)

**추가된 섹션: `FIRST: Identify Project Structure`**

```
## FIRST: Identify Project Structure
1. Check Cargo.toml, package.json, etc. to identify tech stack.
2. Understand existing architecture BEFORE planning.
3. Work WITHIN the existing stack. No conversion.
4. Plan minimal changes to achieve the goal.
```

**한글 해석:**
1. Cargo.toml, package.json 등으로 기술 스택 확인
2. 계획 전에 기존 아키텍처 먼저 이해
3. 기존 스택 내에서 작업. 변환 금지.
4. 목표 달성을 위한 최소 변경 계획

**Atomic Task Creation 추가:**
- `Minimal Scope: Only include tasks the user requested.`

**Boundary Enforcement 추가:**
- `Tasks MUST NOT change the project's language/framework.`
- `Do NOT generate configs (eslint, prettier, etc.) unless requested.`

---

### 3. CODER 프롬프트 (구현자)

**추가된 섹션: `CORE RULE: Minimal Modification`**

```
## CORE RULE: Minimal Modification
- Edit existing code, not rewrite.
- Match existing code style exactly.
- Use existing patterns from the codebase.
- Do NOT add unrelated changes.
- Do NOT convert to different languages/frameworks.
```

**한글 해석:**
- 재작성 말고 기존 코드 수정
- 기존 코드 스타일 정확히 맞추기
- 코드베이스의 기존 패턴 사용
- 관련 없는 변경 추가 금지
- 다른 언어/프레임워크로 변환 금지

**Pre-Submit Checklist 추가:**
- `All references synced after changes.`

---

### 4. REVIEWER 프롬프트 (검토자)

**추가된 섹션: `CORE RULE: Focus on Request Scope`**

```
## CORE RULE: Focus on Request Scope
- Only review what was REQUESTED and CHANGED.
- Do NOT suggest unrelated improvements (lint, formatting, refactoring).
- Do NOT recommend language/framework changes.
- Preserve the existing tech stack.
- Focus on: Does it fulfill the task? Is it correct?
```

**한글 해석:**
- 요청되고 변경된 것만 리뷰
- 관련 없는 개선 제안 금지 (린트, 포매팅, 리팩토링)
- 언어/프레임워크 변경 추천 금지
- 기존 기술 스택 보존
- 집중: 태스크를 수행했는가? 올바른가?

**추가된 섹션: `What NOT to Report`**
- Unrelated lint warnings
- Formatting preferences
- "Nice to have" refactoring
- Framework migration suggestions

---

### 5. FIXER 프롬프트 (수정자)

**추가된 섹션: `CORE RULE: Minimal Fix Only`**

```
## CORE RULE: Minimal Fix Only
- Fix ONLY the reported errors. Nothing else.
- Do NOT add lint fixes, formatting, or refactoring.
- Do NOT change language/framework.
- Smallest possible change that resolves the issue.
```

**한글 해석:**
- 보고된 오류만 수정. 그 외 아무것도 하지 않음.
- 린트 수정, 포매팅, 리팩토링 추가 금지.
- 언어/프레임워크 변경 금지.
- 문제 해결을 위한 가장 작은 변경.

---

### 6. SEARCHER 프롬프트 (검색자)

**추가된 섹션: `CORE RULE: Identify Stack First`**

```
## CORE RULE: Identify Stack First
- FIRST: Check Cargo.toml, package.json, etc.
- Identify the EXISTING tech stack.
- Find patterns that MATCH the current architecture.
- Do NOT suggest alternative frameworks/languages.
```

**한글 해석:**
- 먼저: Cargo.toml, package.json 등 확인
- 기존 기술 스택 식별
- 현재 아키텍처에 맞는 패턴 찾기
- 대체 프레임워크/언어 제안 금지

---

## 🎯 해결된 문제들

| 문제 | 해결 방법 |
|------|-----------|
| Rust → TypeScript 변환 | 모든 에이전트에 "No language/framework conversion" 명시 |
| React 등으로 변환 | Stack Guard 규칙 추가 |
| ESLint 등 불필요한 파일 생성 | "Do NOT generate configs unless requested" 추가 |
| 요청 범위 벗어난 작업 | "Only do what the user explicitly requested" 추가 |
| 코드 동기화 누락 | "All references synced after changes" 체크리스트 추가 |
| 관련 없는 린트 제안 | Reviewer에 "What NOT to Report" 섹션 추가 |
| 부수적인 수정 추가 | Fixer에 "Fix ONLY the reported errors" 명시 |
| 환경 파악 누락 | Orchestrator/Planner에 환경 감지 단계 추가 |
| 빌드 검증 누락 | 빌드/테스트 필수 검증 + Fixer 반복 호출 |
| 업무 분배 불명확 | Agent Delegation 섹션 추가 |

---

## 🆕 신규: 환경 감지 (Environment Detection)

**Orchestrator와 Planner가 먼저 파악:**
1. **OS**: Linux, macOS, Windows
2. **BUILD ENV**: 로컬 설치 vs Docker/Compose
3. 이 정보를 모든 에이전트에게 전달

```
## MANDATORY: Detect Environment
1. OS: Detect operating system (Linux, macOS, Windows)
2. BUILD ENV: Check if using:
   - Local dependencies (direct cargo/npm/etc.)
   - Docker/Compose (containerized builds, local volumes)
```

---

## 🆕 신규: 빌드 검증 루프 (Build Verification Loop)

**미션 완료 조건: 빌드 성공**

```
## Build & Test Verification (MANDATORY)
- After all tasks: RUN build command
- If errors exist: Delegate to Fixer.
- REPEAT until build passes with ZERO errors.
- Mission is NOT complete until build succeeds.
```

**Fixer 활용:**
- 빌드 에러 발생 시 Fixer 반복 호출
- 에러가 0개가 될 때까지 계속 수정
- 절대 포기하지 않음

---

## 🆕 신규: 에이전트 업무 분배 (Agent Delegation)

**Orchestrator가 명확하게 업무 분배:**

| 에이전트 | 역할 |
|----------|------|
| **SEARCHER** | 컨텍스트, 패턴, FIXED zone 찾기 |
| **PLANNER** | 미션을 atomic 태스크로 분해 |
| **CODER** | 한 번에 ONE 태스크만 실행 |
| **REVIEWER** | 요청 범위 내 코드 품질 검증 |
| **FIXER** | 보고된 에러만 수정, 필요시 반복 호출 |

---

## 🔍 핵심 변경 요약

**전체 6개 에이전트에 최소 수정 원칙 + 환경/빌드 규칙 적용:**

| 에이전트 | 핵심 추가 규칙 |
|----------|---------------|
| **Orchestrator** | 환경 감지 + 빌드 검증 루프 + 에이전트 분배 |
| **Planner** | 환경 정보 출력 + 빌드 검증 태스크 필수 포함 |
| **Coder** | 최소 수정 + 참조 동기화 |
| **Reviewer** | 요청 범위만 리뷰 + 린트/포매팅 보고 금지 |
| **Fixer** | 빌드 에러 루프 + 환경 인식 + 반복 호출 대응 |
| **Searcher** | FIXED zone 식별 + 문서 필수 읽기 |

---

*수정일: 2026-01-14*
*수정 파일: `crates/orchestrator-core/src/agents/prompts.rs`*
*빌드 검증: ✅ cargo check 성공*

