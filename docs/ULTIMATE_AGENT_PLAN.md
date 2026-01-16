# 🚀 Ultimate Agent Architecture 개선 계획서

> **목표**: 할루시네이션 최소화 + 무한 자동 실행 + 최적화된 병렬/세션/이벤트 시스템
> **작성일**: 2026-01-16
> **상태**: ✅ 완료

---

## 📋 마스터 체크리스트

### Phase 1: 핵심 인프라 (Foundation)
- [x] **1.1** 이벤트 버스 시스템 도입 ✅
- [x] **1.2** AsyncQueue & Work Pool 구현 ✅
- [x] **1.3** 세션 공유 시스템 구현 ✅
- [x] **1.4** 병렬 도구 초기화 시스템 구현 ✅

### Phase 2: 문서 검색 에이전트 (Anti-Hallucination)
- [x] **2.1** Librarian 에이전트 추가 (문서 검색 전문) ✅
- [x] **2.2** 웹 검색/페치 도구 통합 (webfetch, websearch) ✅
- [x] **2.3** 문서 캐싱 시스템 (.cache/docs/) ✅
- [x] **2.4** Context7/grep.app 연동 (codesearch 도구) ✅

### Phase 3: 무한 실행 시스템 (Relentless Loop v2)
- [x] **3.1** Todo 기반 자동 연속 실행 (모듈 구현 완료) ✅
- [x] **3.2** 횟수 제한 제거 (무한 모드) ✅
- [x] **3.3** 서브 태스크 자동 생성 시스템 ✅
- [x] **3.4** 완료 조건 자동 감지 ✅

### Phase 4: 에이전트 강화
- [x] **4.1** Commander 프롬프트 v3 (할루시네이션 방지) ✅
- [x] **4.2** Architect 계층적 태스크 분해 ✅
- [x] **4.3** Inspector 문서 검증 기능 추가 ✅
- [x] **4.4** 새 에이전트: Researcher (선행 조사) ✅

### Phase 5: 알림 및 모니터링
- [x] **5.1** Toast 알림 시스템 ✅
- [x] **5.2** 진행률 추적 강화 ✅
- [x] **5.3** 에러 복구 자동화 ✅

---

## 📊 구현 현황: 18/18 완료 (100%) 🎉

---

## 🎯 Phase 1: 핵심 인프라

### 1.1 이벤트 버스 시스템

**목적**: 세션 간, 에이전트 간 통신 및 이벤트 발행/구독

```typescript
// src/core/bus/index.ts
export namespace EventBus {
  type Event = {
    type: string;
    properties: Record<string, unknown>;
    timestamp: Date;
    source: string;
  };

  // 구독 관리
  const subscriptions = new Map<string, Set<(event: Event) => void>>();

  export function subscribe(type: string, handler: (event: Event) => void): () => void;
  export function publish(type: string, properties: Record<string, unknown>): void;
  
  // 이벤트 타입들
  export const Events = {
    TASK_STARTED: "task.started",
    TASK_COMPLETED: "task.completed",
    TASK_FAILED: "task.failed",
    TODO_CREATED: "todo.created",
    TODO_COMPLETED: "todo.completed",
    DOCUMENT_CACHED: "document.cached",
    SESSION_IDLE: "session.idle",
    ALL_TASKS_COMPLETE: "tasks.all_complete",
  };
}
```

**수정 파일**:
- `src/core/bus/index.ts` (새로 생성)
- `src/core/bus/types.ts` (새로 생성)
- `src/core/agents/manager.ts` (이벤트 발행 추가)

### 1.2 AsyncQueue & Work Pool

**목적**: 동시성 제한된 병렬 처리

```typescript
// src/core/queue/async-queue.ts
export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolvers: ((value: T) => void)[] = [];
  
  push(item: T): void;
  async next(): Promise<T>;
  async *[Symbol.asyncIterator](): AsyncGenerator<T>;
}

// src/core/queue/work-pool.ts
export async function workPool<T>(
  concurrency: number,
  items: T[],
  fn: (item: T) => Promise<void>
): Promise<void>;
```

**수정 파일**:
- `src/core/queue/async-queue.ts` (새로 생성)
- `src/core/queue/work-pool.ts` (새로 생성)
- `src/core/queue/index.ts` (새로 생성)

### 1.3 세션 공유 시스템

**목적**: 부모-자식 세션 간 컨텍스트 공유

```typescript
// src/core/session/shared-context.ts
export namespace SharedContext {
  interface Context {
    documents: Map<string, CachedDocument>;
    findings: string[];
    decisions: Record<string, string>;
  }

  // 세션 ID → 공유 컨텍스트
  const contexts = new Map<string, Context>();

  export function create(parentSessionID: string): Context;
  export function get(sessionID: string): Context | undefined;
  export function addDocument(sessionID: string, doc: CachedDocument): void;
  export function addFinding(sessionID: string, finding: string): void;
}
```

**수정 파일**:
- `src/core/session/shared-context.ts` (새로 생성)
- `src/core/agents/manager.ts` (컨텍스트 연동)

### 1.4 병렬 도구 초기화

**목적**: 모든 도구를 병렬로 초기화하여 시작 시간 단축

```typescript
// 현재: 순차 초기화
for (const tool of tools) {
  await tool.init();
}

// 개선: 병렬 초기화
await Promise.all(tools.map(tool => tool.init()));
```

**수정 파일**:
- `src/index.ts` (도구 초기화 병렬화)

---

## 🔍 Phase 2: 문서 검색 에이전트 (Anti-Hallucination)

### 2.1 Librarian 에이전트

**목적**: 외부 문서/API 검색 전문 에이전트

```typescript
// src/agents/subagents/librarian.ts
export const librarian: AgentDefinition = {
  id: "librarian",
  description: "Librarian - External documentation and API research specialist",
  systemPrompt: `<role>
You are Librarian. Find official documentation and verified information.
</role>

<constraints>
1. NEVER guess or assume - always search first
2. Always provide source URLs (permalinks)
3. Cache important findings to .cache/docs/
</constraints>

<workflow>
1. IDENTIFY what documentation is needed
2. SEARCH using websearch/webfetch tools
3. VERIFY information from official sources
4. CACHE important docs locally for reference
5. RETURN structured findings with citations
</workflow>

<output_format>
TOPIC: [What was researched]
SOURCES:
- [URL1]: [Key finding]
- [URL2]: [Key finding]

CACHED: [list of cached files]

ANSWER: [Verified information with citations]
</output_format>`,
  canWrite: true,  // .cache/docs/ 에만
  canBash: false,
};
```

### 2.2 웹 검색/페치 도구

**목적**: 외부 문서 검색 및 가져오기

```typescript
// src/tools/web/webfetch.ts
export const webfetchTool = tool({
  description: "Fetch content from a URL and convert to markdown",
  args: {
    url: tool.schema.string().describe("URL to fetch"),
    selector: tool.schema.string().optional().describe("CSS selector to extract"),
  },
  async execute(args) {
    // HTML → Markdown 변환
    // 콘텐츠 반환
  },
});

// src/tools/web/websearch.ts
export const websearchTool = tool({
  description: "Search the web for information",
  args: {
    query: tool.schema.string().describe("Search query"),
    site: tool.schema.string().optional().describe("Limit to specific site"),
  },
  async execute(args) {
    // 검색 수행 (Exa, Perplexity, DuckDuckGo 등)
    // 결과 반환
  },
});
```

**신규 파일**:
- `src/tools/web/webfetch.ts`
- `src/tools/web/websearch.ts`
- `src/tools/web/index.ts`

### 2.3 문서 캐싱 시스템

**목적**: 검색한 문서를 로컬에 저장하여 재참조

```typescript
// src/core/cache/document-cache.ts
export namespace DocumentCache {
  interface CachedDocument {
    url: string;
    title: string;
    content: string;
    fetchedAt: Date;
    expiresAt: Date;
  }

  const CACHE_DIR = ".cache/docs";
  const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24시간

  export async function get(url: string): Promise<CachedDocument | null>;
  export async function set(url: string, content: string, title: string): Promise<string>;
  export async function list(): Promise<CachedDocument[]>;
  export async function clear(): Promise<void>;
}
```

**신규 파일**:
- `src/core/cache/document-cache.ts`
- `src/core/cache/index.ts`

### 2.4 Context7/grep.app 연동

**목적**: OSS 코드베이스 검색

```typescript
// src/tools/web/codesearch.ts
export const codesearchTool = tool({
  description: "Search open source code on GitHub/grep.app",
  args: {
    query: tool.schema.string().describe("Code pattern to search"),
    language: tool.schema.string().optional().describe("Programming language filter"),
    repo: tool.schema.string().optional().describe("Specific repository"),
  },
  async execute(args) {
    // grep.app API 호출
    // 결과 반환 with permalinks
  },
});
```

---

## ♾️ Phase 3: 무한 실행 시스템

### 3.1 Todo 기반 자동 연속 실행

**목적**: Todo 목록이 완료될 때까지 자동 연속 실행

```typescript
// src/core/loop/todo-enforcer.ts
export namespace TodoEnforcer {
  interface Todo {
    id: string;
    content: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    priority: "high" | "medium" | "low";
    parentId?: string;  // 계층적 태스크 지원
  }

  export async function checkAndContinue(sessionID: string): Promise<boolean>;
  export function getIncompleteCount(sessionID: string): number;
  export function hasRemainingWork(sessionID: string): boolean;
}
```

### 3.2 횟수 제한 제거

**목적**: 작업이 완료될 때까지 무한 실행

```typescript
// src/index.ts 수정
const sessions = new Map<string, {
    active: boolean;
    step: number;
    maxSteps: number;  // Infinity로 설정 가능
    // ...
}>();

// 무한 모드 활성화
const UNLIMITED_MODE = true;
const DEFAULT_MAX_STEPS = UNLIMITED_MODE ? Infinity : 500;
```

**수정 로직**:
```typescript
// 기존: 스텝 제한 체크
if (session.step >= session.maxSteps) {
  // 중단
}

// 개선: Todo 기반 완료 체크
if (!TodoEnforcer.hasRemainingWork(sessionID)) {
  // 모든 Todo 완료 시에만 중단
}
```

### 3.3 서브 태스크 자동 생성

**목적**: 복잡한 작업을 계층적 태스크로 자동 분해

```typescript
// src/core/task/task-decomposer.ts
export namespace TaskDecomposer {
  interface TaskNode {
    id: string;
    description: string;
    parent?: string;
    children: string[];
    status: "pending" | "running" | "completed" | "failed";
    agent: string;
  }

  export function createHierarchy(mainTask: string): TaskNode[];
  export function getNextTasks(rootId: string): TaskNode[];
  export function updateStatus(taskId: string, status: TaskNode["status"]): void;
}
```

### 3.4 완료 조건 자동 감지

**목적**: 작업 완료를 자동으로 감지

```typescript
// src/core/loop/completion-detector.ts
export namespace CompletionDetector {
  interface CompletionCriteria {
    allTodosComplete: boolean;
    noRunningTasks: boolean;
    noErrors: boolean;
    verificationPassed: boolean;
  }

  export function check(sessionID: string): CompletionCriteria;
  export function isComplete(sessionID: string): boolean;
  
  // 완료 감지 패턴
  const COMPLETION_PATTERNS = [
    /✅\s*MISSION\s*COMPLETE/i,
    /ALL\s*TASKS?\s*COMPLETED?/i,
    /<promise>DONE<\/promise>/i,
  ];
}
```

---

## 🤖 Phase 4: 에이전트 강화

### 4.1 Commander 프롬프트 v3

**핵심 개선사항**:
1. 작업 전 문서 검색 의무화
2. Pre-Delegation Planning 강제
3. 할루시네이션 감지 및 자가 수정

```typescript
// src/agents/orchestrator.ts - 주요 추가 섹션
const ANTI_HALLUCINATION = `
<anti_hallucination>
BEFORE ANY IMPLEMENTATION:
1. If unfamiliar with API/library → CALL librarian FIRST
2. If uncertain about patterns → CALL architect to research
3. NEVER assume - always verify

WHEN YOU CATCH YOURSELF GUESSING:
- STOP immediately
- Search documentation
- Cache findings to .cache/docs/
- Then proceed with verified information
</anti_hallucination>
`;

const PRE_DELEGATION_PLANNING = `
<pre_delegation_planning>
BEFORE EVERY delegate_task, EXPLICITLY DECLARE:

1. TASK: Atomic, specific goal (one action per delegation)
2. EXPECTED OUTCOME: Concrete deliverables
3. REQUIRED TOOLS: Explicit tool whitelist
4. MUST DO: Exhaustive requirements
5. MUST NOT DO: Forbidden actions
6. CONTEXT: File paths, patterns, constraints
7. VERIFICATION: How to confirm success
</pre_delegation_planning>
`;
```

### 4.2 Architect 계층적 태스크 분해

**개선사항**:
- Todo 트리 자동 생성
- 병렬 가능 태스크 자동 그룹화

```typescript
// src/agents/subagents/architect.ts 개선
const HIERARCHICAL_PLANNING = `
<task_hierarchy>
Create hierarchical todo structure:

LEVEL 1: Main objectives (2-5 items)
  LEVEL 2: Sub-tasks (2-3 per L1)
    LEVEL 3: Atomic actions (1-3 per L2)

OUTPUT FORMAT:
\`\`\`
TODO_HIERARCHY:
- [L1] Main objective 1
  - [L2] Sub-task 1.1 | parallel_group:A
  - [L2] Sub-task 1.2 | parallel_group:A
  - [L2] Sub-task 1.3 | depends:1.1,1.2
- [L1] Main objective 2
  ...
\`\`\`
</task_hierarchy>
`;
```

### 4.3 Inspector 문서 검증 기능

**개선사항**:
- 코드가 문서와 일치하는지 검증
- 캐시된 문서 참조

```typescript
// src/agents/subagents/inspector.ts 개선
const DOCUMENT_VERIFICATION = `
<document_verification>
WHEN VERIFYING IMPLEMENTATION:
1. Check .cache/docs/ for related documentation
2. Compare implementation against official docs
3. Flag any deviations

VERIFICATION_OUTPUT:
- DOC_MATCH: [yes/no]
- DEVIATIONS: [list if any]
- RECOMMENDATION: [fix/accept]
</document_verification>
`;
```

### 4.4 새 에이전트: Researcher

**목적**: 작업 시작 전 선행 조사

```typescript
// src/agents/subagents/researcher.ts
export const researcher: AgentDefinition = {
  id: "researcher",
  description: "Researcher - Pre-task investigation and documentation",
  systemPrompt: `<role>
You are Researcher. Gather all necessary information BEFORE implementation begins.
</role>

<workflow>
1. ANALYZE the task requirements
2. IDENTIFY unfamiliar technologies/APIs
3. SEARCH for official documentation
4. FIND existing patterns in codebase
5. CACHE important references
6. REPORT findings with actionable summary
</workflow>

<output_format>
RESEARCH REPORT:

TECHNOLOGIES INVOLVED:
- [tech1]: [official doc URL] → [key insights]

CODEBASE PATTERNS:
- [pattern1]: Found in [file] → [usage example]

CACHED DOCUMENTS:
- .cache/docs/[filename]: [description]

RECOMMENDATIONS:
- [actionable recommendation 1]
- [actionable recommendation 2]

READY FOR IMPLEMENTATION: [yes/no]
</output_format>`,
  canWrite: true,
  canBash: true,
};
```

---

## 📢 Phase 5: 알림 및 모니터링

### 5.1 Toast 알림 시스템

```typescript
// src/core/notification/toast.ts
export namespace Toast {
  type Variant = "info" | "success" | "warning" | "error";

  export async function show(options: {
    title: string;
    message: string;
    variant: Variant;
    duration?: number;
  }): Promise<void>;
  
  // 프리셋
  export const taskStarted = (taskId: string) => show({ ... });
  export const taskCompleted = (taskId: string) => show({ ... });
  export const allTasksComplete = (count: number) => show({ ... });
  export const documentCached = (url: string) => show({ ... });
}
```

### 5.2 진행률 추적 강화

```typescript
// src/core/progress/tracker.ts
export namespace ProgressTracker {
  interface Progress {
    total: number;
    completed: number;
    failed: number;
    running: number;
    percentage: number;
  }

  export function get(sessionID: string): Progress;
  export function update(sessionID: string, taskId: string, status: string): void;
  export function format(sessionID: string): string; // "3/10 (30%)"
}
```

### 5.3 에러 복구 자동화

```typescript
// src/core/recovery/auto-recovery.ts
export namespace AutoRecovery {
  interface RecoveryAction {
    type: "retry" | "skip" | "escalate" | "resume";
    taskId: string;
    reason: string;
  }

  export async function handleError(
    sessionID: string, 
    error: Error, 
    context: unknown
  ): Promise<RecoveryAction>;
  
  // 복구 전략
  const strategies = {
    "rate_limit": async () => { /* wait and retry */ },
    "context_overflow": async () => { /* compact and retry */ },
    "tool_error": async () => { /* try alternative */ },
    "gibberish": async () => { /* inject recovery prompt */ },
  };
}
```

---

## 📁 파일 구조 변경

```
src/
├── agents/
│   └── subagents/
│       ├── architect.ts (수정)
│       ├── builder.ts (수정)
│       ├── inspector.ts (수정)
│       ├── recorder.ts (기존)
│       ├── librarian.ts (신규) ⭐
│       └── researcher.ts (신규) ⭐
├── core/
│   ├── agents/ (기존)
│   ├── bus/ (신규) ⭐
│   │   ├── index.ts
│   │   └── types.ts
│   ├── cache/ (신규) ⭐
│   │   ├── document-cache.ts
│   │   └── index.ts
│   ├── loop/ (신규) ⭐
│   │   ├── todo-enforcer.ts
│   │   └── completion-detector.ts
│   ├── notification/ (신규) ⭐
│   │   └── toast.ts
│   ├── progress/ (신규) ⭐
│   │   └── tracker.ts
│   ├── queue/ (신규) ⭐
│   │   ├── async-queue.ts
│   │   ├── work-pool.ts
│   │   └── index.ts
│   ├── recovery/ (신규) ⭐
│   │   └── auto-recovery.ts
│   ├── session/ (신규) ⭐
│   │   └── shared-context.ts
│   └── task/ (신규) ⭐
│       └── task-decomposer.ts
├── tools/
│   ├── parallel/ (기존)
│   └── web/ (신규) ⭐
│       ├── webfetch.ts
│       ├── websearch.ts
│       ├── codesearch.ts
│       └── index.ts
└── index.ts (수정)
```

---

## 🔢 구현 우선순위

### 🔴 Phase 1 (즉시 시작)
| 순서 | 태스크 | 예상 시간 | 중요도 |
|------|--------|----------|--------|
| 1 | Librarian 에이전트 | 30분 | ⭐⭐⭐ |
| 2 | webfetch/websearch 도구 | 1시간 | ⭐⭐⭐ |
| 3 | 문서 캐싱 시스템 | 30분 | ⭐⭐⭐ |
| 4 | Commander 프롬프트 v3 | 30분 | ⭐⭐⭐ |

### 🟡 Phase 2 (다음 단계)
| 순서 | 태스크 | 예상 시간 | 중요도 |
|------|--------|----------|--------|
| 5 | Todo 기반 자동 실행 | 1시간 | ⭐⭐⭐ |
| 6 | 횟수 제한 제거 | 30분 | ⭐⭐ |
| 7 | 이벤트 버스 시스템 | 1시간 | ⭐⭐ |
| 8 | AsyncQueue/Work Pool | 30분 | ⭐⭐ |

### 🟢 Phase 3 (완성도 높이기)
| 순서 | 태스크 | 예상 시간 | 중요도 |
|------|--------|----------|--------|
| 9 | Researcher 에이전트 | 30분 | ⭐⭐ |
| 10 | 세션 공유 시스템 | 1시간 | ⭐⭐ |
| 11 | 진행률 추적 강화 | 30분 | ⭐ |
| 12 | Toast 알림 시스템 | 30분 | ⭐ |
| 13 | 에러 복구 자동화 | 1시간 | ⭐ |

---

## ✅ 즉시 실행 계획

**지금부터 순차적으로 구현합니다:**

1. ✅ `src/agents/subagents/librarian.ts` - 문서 검색 에이전트
2. [ ] `src/tools/web/webfetch.ts` - URL 콘텐츠 가져오기
3. [ ] `src/tools/web/websearch.ts` - 웹 검색
4. [ ] `src/core/cache/document-cache.ts` - 문서 캐싱
5. [ ] `src/agents/orchestrator.ts` - Anti-Hallucination 프롬프트
6. [ ] `src/core/loop/todo-enforcer.ts` - Todo 기반 자동 실행
7. [ ] `src/index.ts` - 무한 모드 활성화

---

**작성자**: OpenCode Orchestrator  
**다음 단계**: Phase 1의 첫 번째 태스크 구현 시작
