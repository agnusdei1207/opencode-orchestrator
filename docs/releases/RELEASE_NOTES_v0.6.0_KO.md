# v0.6.0 릴리즈 노트

## 🚀 궁극의 에이전트 아키텍처

이번 릴리즈는 OpenCode Orchestrator의 종합적인 업그레이드를 도입합니다. 궁극의 에이전트 아키텍처 시스템을 구현하여 할루시네이션 방지, 무한 실행 모드, 계층적 태스크 분해, 고급 인프라 컴포넌트를 제공합니다.

---

## ✨ 신규 기능

### 1. 할루시네이션 방지 시스템

#### Librarian 에이전트 (`src/agents/subagents/librarian.ts`)
- **목적**: 문서 검색 전문가
- **기능**:
  - 구현 전 공식 문서 검색
  - 팀 참조용 검색 결과 캐싱
  - 인용이 포함된 검증된 정보 제공
  - AI 응답의 허위 정보 감소

#### Researcher 에이전트 (`src/agents/subagents/researcher.ts`)
- **목적**: 사전 조사 전문가
- **기능**:
  - 코딩 전 필요한 모든 정보 수집
  - 작업 요구사항 분석
  - 코드베이스의 기존 패턴 발견
  - 잠재적 위험 식별

### 2. 웹 검색 도구

#### `webfetch` 도구
```typescript
webfetch({ url: "https://docs.example.com/api" })
```
- URL 콘텐츠를 가져와 HTML을 Markdown으로 변환
- 설정 가능한 TTL로 자동 캐싱
- 요청 제한 준수

#### `websearch` 도구
```typescript
websearch({ query: "Next.js 14 앱 라우터 튜토리얼" })
```
- DuckDuckGo API를 사용한 웹 검색
- URL이 포함된 형식화된 결과 반환
- 필터링 및 팁 지원

#### `codesearch` 도구
```typescript
codesearch({ query: "useEffect cleanup", language: "typescript" })
```
- grep.app을 통한 오픈소스 코드 검색
- 실제 사용 패턴 발견
- GitHub 소스 링크 제공

#### `cache_docs` 도구
```typescript
cache_docs({ action: "list" })
cache_docs({ action: "get", filename: "nextjs_app_router.md" })
```
- 캐시된 문서 관리
- 목록, 검색, 삭제, 통계 기능

### 3. 문서 캐싱 시스템 (`src/core/cache/document-cache.ts`)
- `.cache/docs/`에 가져온 문서 저장
- 자동 만료 처리
- 메타데이터 추적 (소스 URL, 가져온 시간, 크기)
- 통계 및 정리 유틸리티

### 4. 무한 실행 모드

#### 설정
```typescript
const UNLIMITED_MODE = true;  // 기본값: 활성화
```

- **단계 제한 없음**: 미션 완료까지 실행 계속
- **Todo 기반 실행**: 모든 대기 항목 처리
- **완료 감지**: 자동 미션 완료 감지

#### Todo Enforcer (`src/core/loop/todo-enforcer.ts`)
- 우선순위와 상태를 가진 todo 항목 추적
- 미완료 작업을 위한 연속 프롬프트 생성
- 진행 통계 제공

### 5. 이벤트 버스 시스템 (`src/core/bus/index.ts`)
- 컴포넌트 간 통신을 위한 **Pub/Sub 패턴**
- **이벤트 타입**:
  - `task.started`, `task.completed`, `task.failed`
  - `todo.created`, `todo.updated`, `todo.completed`
  - `session.idle`, `session.busy`, `session.error`
  - `mission.complete`, `mission.failed`
- **기능**:
  - 핸들러 구독/구독 취소
  - 일회성 구독
  - 와일드카드 구독 (`*`)
  - 이벤트 히스토리 추적
  - Promise 기반 `waitFor` 메서드

### 6. AsyncQueue & Work Pool (`src/core/queue/index.ts`)
- **AsyncQueue**: 생산자/소비자 패턴을 위한 비동기 반복 가능 큐
- **workPool**: 제한이 있는 동시 태스크 실행
- **workPoolWithResults**: 원래 순서대로 결과 반환
- **processBatches**: 배치 처리 유틸리티
- **retryWithBackoff**: 지수 백오프 재시도
- **withTimeout**: 타임아웃 래퍼

### 7. 세션 공유 컨텍스트 (`src/core/session/shared-context.ts`)
- 부모와 자식 세션 간 컨텍스트 공유
- **추적 가능한 항목**:
  - 캐시된 문서
  - 주요 발견사항 (패턴, API, 설정, 경고)
  - 내린 결정
- 부모-자식 간 컨텍스트 병합

### 8. 계층적 태스크 분해 (`src/core/task/task-decomposer.ts`)
- **3단계 계층**: L1 (목표) → L2 (하위 작업) → L3 (원자적 동작)
- **병렬 그룹**: 동시에 실행할 수 있는 태스크
- **의존성**: `dependsOn`을 통한 태스크 순서 지정
- **진행 추적**: 실시간 완료 백분율
- **텍스트 파싱**: Architect 출력에서 계층 파싱

### 9. Toast 알림 시스템 (`src/core/notification/toast.ts`)
- 태스크 이벤트에 대한 시각적 알림
- **프리셋 알림**:
  - 태스크 시작/완료/실패
  - 미션 완료
  - 문서 캐시됨
  - 요청 제한 경고
- 이벤트 버스 연동

### 10. 진행률 추적기 (`src/core/progress/tracker.ts`)
- 실시간 진행 스냅샷
- 경과 시간 추적
- 진행 바 형식화
- 속도 계산 (항목/분)
- 남은 시간 추정

### 11. 자동 복구 시스템 (`src/core/recovery/auto-recovery.ts`)
- **자동 오류 처리**:
  - 요청 제한: 지수 백오프
  - 컨텍스트 오버플로우: 컨텍스트 압축
  - 네트워크 오류: 백오프로 재시도
  - 세션 오류: 우아하게 중단
  - 파싱 오류: 재시도 후 건너뛰기
- 자동 재시도를 위한 **`withRecovery` 래퍼**
- 복구 통계 및 히스토리

---

## 🔧 에이전트 강화

### Commander 에이전트
- **할루시네이션 방지 섹션** 프롬프트에 추가
- 검색 워크플로우 지침
- 필수 검색 트리거
- Librarian 사용 가이드라인

### Architect 에이전트
- **계층적 태스크 분해** (L1/L2/L3)
- 병렬 그룹 지정
- 의존성 추적
- 새 에이전트 할당 (librarian, researcher)

### Inspector 에이전트
- **문서 검증** 추가
- 캐시 확인 지침
- 출력 형식에 문서 준수 여부
- 이탈 항목 플래그

---

## 📁 신규 파일

```
src/
├── agents/subagents/
│   ├── librarian.ts           # 문서 검색 에이전트
│   └── researcher.ts          # 사전 조사 에이전트
├── core/
│   ├── bus/
│   │   └── index.ts           # 이벤트 버스 시스템
│   ├── cache/
│   │   ├── document-cache.ts  # 문서 캐싱
│   │   └── index.ts
│   ├── loop/
│   │   └── todo-enforcer.ts   # Todo 기반 실행
│   ├── notification/
│   │   └── toast.ts           # Toast 알림
│   ├── progress/
│   │   └── tracker.ts         # 진행률 추적
│   ├── queue/
│   │   └── index.ts           # AsyncQueue & Work Pool
│   ├── recovery/
│   │   └── auto-recovery.ts   # 자동 복구 시스템
│   ├── session/
│   │   └── shared-context.ts  # 세션 컨텍스트 공유
│   └── task/
│       └── task-decomposer.ts # 계층적 태스크
└── tools/web/
    ├── webfetch.ts            # URL 가져오기
    ├── websearch.ts           # 웹 검색
    ├── codesearch.ts          # 코드 검색
    ├── cache-docs.ts          # 캐시 관리
    └── index.ts

tests/unit/
├── event-bus.test.ts          # 11개 테스트
├── async-queue.test.ts        # 14개 테스트
├── todo-enforcer.test.ts      # 18개 테스트
├── document-cache.test.ts     # 12개 테스트
├── shared-context.test.ts     # 12개 테스트
├── task-decomposer.test.ts    # 14개 테스트
├── toast.test.ts              # 11개 테스트
├── progress-tracker.test.ts   # 12개 테스트
└── auto-recovery.test.ts      # 10개 테스트
```

---

## 🧪 테스트 커버리지

```
테스트 파일:  17개 통과
테스트:       202개 통과
소요 시간:    약 4.2초
```

### 신규 테스트 스위트
- EventBus: 11개 테스트
- AsyncQueue: 14개 테스트
- TodoEnforcer: 18개 테스트
- DocumentCache: 12개 테스트
- SharedContext: 12개 테스트
- TaskDecomposer: 14개 테스트
- Toast: 11개 테스트
- ProgressTracker: 12개 테스트
- AutoRecovery: 10개 테스트

---

## 📊 빌드 크기

```
dist/index.js: 552.2kb
```

---

## 🚀 사용법

### 무한 모드 활성화 (기본값)
무한 모드는 기본적으로 활성화되어 있습니다. 모든 명령어 (`/task`, 일반 메시지, 에이전트 선택)가 무한 모드로 동작합니다.

### 구현 전 검색
```typescript
// Commander가 자동으로:
// 1. 문서 검색
websearch({ query: "API 문서" })

// 2. 공식 문서 가져오기
webfetch({ url: "https://official-docs.com/...", cache: true })

// 3. 또는 Librarian에게 위임
delegate_task({ agent: "librarian", prompt: "X API 검색" })
```

### 계층적 태스크 계획
```
/task 사용자 인증 구현

// Architect 출력:
- [L1] 인증 인프라 설정
  - [L2] 인증 패턴 검색 | agent:librarian
  - [L2] JWT 핸들러 구현 | agent:builder | depends:2.1
  - [L2] 로그인 엔드포인트 생성 | agent:builder | parallel_group:A
  - [L2] 회원가입 엔드포인트 생성 | agent:builder | parallel_group:A
  - [L2] 구현 검증 | agent:inspector | depends:2.3,2.4
```

---

## ⚠️ 주요 변경사항

없음. 이번 릴리즈는 이전 버전과 호환됩니다.

---

## 🔄 마이그레이션

마이그레이션이 필요하지 않습니다. 단순히 v0.6.0으로 업데이트하세요:

```bash
npm install opencode-orchestrator@latest
```

---

## 📝 기여자

agnusdei1207이 ❤️으로 만들었습니다
