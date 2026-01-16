# OpenCode 프로젝트 완전 해부

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [핵심 아키텍처](#3-핵심-아키텍처)
4. [에이전트 시스템](#4-에이전트-시스템)
5. [세션 및 메시지 처리](#5-세션-및-메시지-처리)
6. [도구(Tool) 시스템](#6-도구tool-시스템)
7. [리소스 관리 및 자원 회수](#7-리소스-관리-및-자원-회수)
8. [병렬 처리 및 동시성](#8-병렬-처리-및-동시성)
9. [백그라운드 처리](#9-백그라운드-처리)
10. [인프라 및 배포](#10-인프라-및-배포)
11. [플러그인 시스템](#11-플러그인-시스템)
12. [MCP (Model Context Protocol)](#12-mcp-model-context-protocol)
13. [권한 시스템](#13-권한-시스템)
14. [스냅샷 및 버전 관리](#14-스냅샷-및-버전-관리)
15. [컨텍스트 압축 (Compaction)](#15-컨텍스트-압축-compaction)

---

## 1. 프로젝트 개요

### 1.1 OpenCode란?

OpenCode는 **100% 오픈소스 AI 코딩 에이전트**입니다. Claude Code와 유사한 기능을 제공하지만, 다음과 같은 차별점이 있습니다:

- **프로바이더 독립적**: Claude, OpenAI, Google, 로컬 모델 등 다양한 AI 프로바이더 지원
- **LSP 지원**: 언어 서버 프로토콜을 기본 지원하여 정확한 코드 분석 가능
- **TUI 중심**: Neovim 사용자들이 만든 터미널 기반 UI
- **클라이언트/서버 아키텍처**: 원격 제어 가능 (예: 모바일 앱에서 데스크톱의 OpenCode 제어)

### 1.2 기술 스택

| 구분 | 기술 |
|------|------|
| 런타임 | **Bun 1.3+** |
| 언어 | TypeScript (ESM 모듈) |
| UI 프레임워크 | SolidJS |
| TUI 라이브러리 | OpenTUI |
| 데스크톱 앱 | Tauri |
| 인프라 | SST (Serverless Stack) |
| 클라우드 | Cloudflare Workers |
| 데이터베이스 | PlanetScale (MySQL) |
| 패키지 관리 | Bun + Turbo (모노레포) |

---

## 2. 프로젝트 구조

```
opencode/
├── packages/                    # 핵심 패키지들
│   ├── opencode/               # 🎯 코어 비즈니스 로직 & 서버
│   │   └── src/
│   │       ├── agent/          # 에이전트 정의
│   │       ├── session/        # 세션 관리
│   │       ├── tool/           # 도구 시스템
│   │       ├── server/         # HTTP/WebSocket 서버
│   │       ├── provider/       # AI 프로바이더 통합
│   │       ├── mcp/            # MCP 클라이언트
│   │       ├── lsp/            # LSP 통합
│   │       ├── plugin/         # 플러그인 시스템
│   │       ├── permission/     # 권한 관리
│   │       ├── storage/        # 데이터 저장
│   │       ├── bus/            # 이벤트 버스
│   │       ├── pty/            # 터미널 에뮬레이션
│   │       ├── snapshot/       # Git 스냅샷
│   │       ├── project/        # 프로젝트/인스턴스 관리
│   │       ├── cli/            # CLI 명령어
│   │       └── util/           # 유틸리티
│   ├── app/                    # 웹 UI 컴포넌트 (SolidJS)
│   ├── desktop/                # 데스크톱 앱 (Tauri)
│   ├── console/                # OpenCode 콘솔 (웹 대시보드)
│   ├── plugin/                 # @opencode-ai/plugin 패키지
│   ├── sdk/                    # @opencode-ai/sdk 패키지
│   └── ui/                     # 공유 UI 컴포넌트
├── infra/                      # SST 인프라 정의
│   ├── app.ts                  # API, 웹, 웹앱
│   ├── console.ts              # 콘솔 인프라
│   └── enterprise.ts           # 엔터프라이즈 기능
├── github/                     # GitHub 액션 관련
├── nix/                        # Nix 패키징
└── script/                     # 빌드/배포 스크립트
```

---

## 3. 핵심 아키텍처

### 3.1 클라이언트-서버 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트                            │
│  ┌─────────┐  ┌─────────────┐  ┌──────────────┐            │
│  │   TUI   │  │  Desktop    │  │    Web App   │            │
│  │(SolidJS)│  │  (Tauri)    │  │   (SolidJS)  │            │
│  └────┬────┘  └──────┬──────┘  └──────┬───────┘            │
│       │              │                │                     │
│       └──────────────┴────────────────┘                     │
│                      │                                      │
│              @opencode-ai/sdk                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/WebSocket
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    OpenCode 서버                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Hono HTTP Server                      │ │
│  │  • REST API          • WebSocket (PTY, Events)          │ │
│  │  • Server-Sent Events                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           │                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Instance Layer                        │ │
│  │  • Project Context    • State Management                │ │
│  │  • Directory Isolation                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           │                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ │
│  │Session │ │ Agent  │ │ Tools  │ │  MCP   │ │   LSP      │ │
│  │Manager │ │ System │ │Registry│ │Clients │ │  Clients   │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘ │
│                           │                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   AI SDK Layer                           │ │
│  │  • Provider Abstraction   • Model Selection             │ │
│  │  • Streaming              • Tool Calling                │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 인스턴스 (Instance) 패턴

OpenCode의 핵심 설계 패턴 중 하나는 **Instance** 패턴입니다:

```typescript
// packages/opencode/src/project/instance.ts
export const Instance = {
  // 디렉토리별 독립적인 컨텍스트 제공
  async provide<R>(input: { 
    directory: string; 
    init?: () => Promise<any>; 
    fn: () => R 
  }): Promise<R>
  
  // 현재 작업 디렉토리
  get directory(): string
  
  // Git worktree 경로
  get worktree(): string
  
  // 프로젝트 정보
  get project(): Project.Info
  
  // 인스턴스 범위의 상태 생성 (dispose 콜백 지원)
  state<S>(init: () => S, dispose?: (state: Awaited<S>) => Promise<void>): () => S
  
  // 인스턴스 정리
  async dispose(): Promise<void>
}
```

**핵심 개념:**
- 각 디렉토리마다 독립적인 인스턴스가 생성됨
- `Instance.state()`로 생성된 상태는 해당 인스턴스에 바인딩됨
- 인스턴스 dispose 시 모든 관련 리소스가 자동 정리됨

### 3.3 상태 관리 (State)

```typescript
// packages/opencode/src/project/state.ts
export namespace State {
  // 키(디렉토리)별로 상태 저장소 관리
  const recordsByKey = new Map<string, Map<any, Entry>>()
  
  export function create<S>(
    root: () => string,           // 루트 키 (보통 디렉토리 경로)
    init: () => S,                // 초기화 함수
    dispose?: (state) => Promise<void>  // 정리 함수
  ): () => S
  
  export async function dispose(key: string): Promise<void>
}
```

---

## 4. 에이전트 시스템

### 4.1 에이전트 타입

OpenCode는 다양한 에이전트를 지원합니다:

| 에이전트 | 모드 | 설명 |
|---------|------|------|
| `build` | primary | 기본 개발 에이전트, 모든 도구 접근 가능 |
| `plan` | primary | 읽기 전용 분석 에이전트, 파일 수정 불가 |
| `general` | subagent | 복잡한 검색 및 멀티스텝 작업용 서브에이전트 |
| `explore` | subagent | 코드베이스 탐색 특화 에이전트 |
| `compaction` | hidden | 컨텍스트 압축 전용 에이전트 |
| `title` | hidden | 세션 제목 생성 에이전트 |
| `summary` | hidden | 요약 생성 에이전트 |

### 4.2 에이전트 정의 구조

```typescript
// packages/opencode/src/agent/agent.ts
export namespace Agent {
  export const Info = z.object({
    name: z.string(),
    description: z.string().optional(),
    mode: z.enum(["subagent", "primary", "all"]),
    native: z.boolean().optional(),      // 빌트인 에이전트 여부
    hidden: z.boolean().optional(),      // UI에서 숨김 여부
    topP: z.number().optional(),
    temperature: z.number().optional(),
    color: z.string().optional(),
    permission: PermissionNext.Ruleset,  // 권한 규칙
    model: z.object({                    // 고정 모델 (선택)
      modelID: z.string(),
      providerID: z.string(),
    }).optional(),
    prompt: z.string().optional(),       // 시스템 프롬프트
    options: z.record(z.string(), z.any()),
    steps: z.number().int().positive().optional(),  // 최대 스텝 수
  })
}
```

### 4.3 에이전트 권한 시스템

각 에이전트는 고유한 권한 세트를 가집니다:

```typescript
// build 에이전트 예시
build: {
  permission: PermissionNext.merge(
    defaults,
    PermissionNext.fromConfig({
      question: "allow",
      plan_enter: "allow",
    }),
    user,
  ),
}

// plan 에이전트 예시 (읽기 전용)
plan: {
  permission: PermissionNext.merge(
    defaults,
    PermissionNext.fromConfig({
      question: "allow",
      plan_exit: "allow",
      edit: {
        "*": "deny",  // 모든 파일 수정 거부
        [".opencode/plans/*.md"]: "allow",  // 계획 파일만 허용
      },
    }),
    user,
  ),
}
```

---

## 5. 세션 및 메시지 처리

### 5.1 세션 구조

```typescript
// packages/opencode/src/session/index.ts
export const Info = z.object({
  id: Identifier.schema("session"),
  slug: z.string(),
  projectID: z.string(),
  directory: z.string(),
  parentID: z.string().optional(),  // 부모 세션 (서브태스크용)
  summary: z.object({               // 변경 요약
    additions: z.number(),
    deletions: z.number(),
    files: z.number(),
    diffs: Snapshot.FileDiff.array().optional(),
  }).optional(),
  share: z.object({                 // 공유 정보
    url: z.string(),
  }).optional(),
  title: z.string(),
  version: z.string(),
  time: z.object({
    created: z.number(),
    updated: z.number(),
    compacting: z.number().optional(),
    archived: z.number().optional(),
  }),
  permission: PermissionNext.Ruleset.optional(),
  revert: z.object({...}).optional(),
})
```

### 5.2 메시지 처리 플로우

```
사용자 입력
    │
    ▼
┌─────────────────────────────────────────┐
│        SessionPrompt.prompt()           │
│  1. 사용자 메시지 생성                    │
│  2. 세션 권한 설정                        │
│  3. loop() 호출                          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│        SessionPrompt.loop()             │
│  • 메시지 스트림 필터링                   │
│  • 마지막 사용자/어시스턴트 메시지 확인    │
│  • 컨텍스트 오버플로우 체크               │
│  • 도구 해결 (resolveTools)              │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│      SessionProcessor.process()         │
│  • LLM 스트림 시작                       │
│  • 추론(reasoning) 처리                  │
│  • 텍스트 델타 처리                      │
│  • 도구 호출 처리                        │
│  • 스냅샷 추적                           │
│  • 사용량 계산                           │
└─────────────────────────────────────────┘
    │
    ├──► "continue" → loop 계속
    ├──► "compact"  → 컨텍스트 압축
    └──► "stop"     → 종료
```

### 5.3 프로세서 상태 머신

```typescript
// packages/opencode/src/session/processor.ts
export namespace SessionProcessor {
  export function create(input: {...}) {
    // 도구 호출 추적
    const toolcalls: Record<string, MessageV2.ToolPart> = {}
    let snapshot: string | undefined
    let blocked = false
    let attempt = 0
    let needsCompaction = false
    
    return {
      async process(streamInput: LLM.StreamInput) {
        while (true) {
          const stream = await LLM.stream(streamInput)
          
          for await (const value of stream.fullStream) {
            switch (value.type) {
              case "start": // 세션 상태를 busy로
              case "reasoning-start/delta/end": // 추론 처리
              case "tool-input-start/delta/end": // 도구 입력 처리
              case "tool-call": // 도구 호출 (doom loop 감지 포함)
              case "tool-result/error": // 도구 결과 처리
              case "start-step": // 스냅샷 추적 시작
              case "finish-step": // 사용량 계산, 스냅샷 패치
              case "text-start/delta/end": // 텍스트 응답 처리
              // ...
            }
          }
        }
      }
    }
  }
}
```

---

## 6. 도구(Tool) 시스템

### 6.1 도구 정의

```typescript
// packages/opencode/src/tool/tool.ts
export namespace Tool {
  export interface Info<Parameters, Metadata> {
    id: string
    init: (ctx?: InitContext) => Promise<{
      description: string
      parameters: Parameters
      execute(args, ctx: Context): Promise<{
        title: string
        metadata: Metadata
        output: string
        attachments?: MessageV2.FilePart[]
      }>
      formatValidationError?(error: z.ZodError): string
    }>
  }
  
  export interface Context {
    sessionID: string
    messageID: string
    agent: string
    abort: AbortSignal       // 취소 시그널
    callID?: string
    extra?: { [key: string]: any }
    metadata(input): void    // 실행 중 메타데이터 업데이트
    ask(input): Promise<void> // 권한 요청
  }
}
```

### 6.2 내장 도구 목록

| 도구 | 설명 |
|------|------|
| `bash` | 셸 명령 실행 |
| `read` | 파일 읽기 |
| `edit` | 파일 수정 |
| `write` | 파일 생성 |
| `glob` | 파일 패턴 검색 |
| `grep` | 텍스트 검색 |
| `task` | 서브태스크 생성 |
| `question` | 사용자에게 질문 |
| `webfetch` | URL 콘텐츠 가져오기 |
| `websearch` | 웹 검색 |
| `codesearch` | 코드 검색 |
| `skill` | 스킬 파일 로드 |
| `todoread/todowrite` | TODO 관리 |
| `lsp` | LSP 기능 (실험적) |
| `batch` | 배치 작업 (실험적) |

### 6.3 도구 레지스트리

```typescript
// packages/opencode/src/tool/registry.ts
export namespace ToolRegistry {
  // 인스턴스별 커스텀 도구 저장
  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[]
    
    // 설정 디렉토리에서 커스텀 도구 로드
    for (const dir of await Config.directories()) {
      // {tool,tools}/*.{js,ts} 파일 검색
      // ...
    }
    
    // 플러그인에서 도구 로드
    const plugins = await Plugin.list()
    for (const plugin of plugins) {
      for (const [id, def] of Object.entries(plugin.tool ?? {})) {
        custom.push(fromPlugin(id, def))
      }
    }
    
    return { custom }
  })
  
  export async function tools(providerID: string, agent?: Agent.Info) {
    // 내장 도구 + 커스텀 도구 반환
  }
}
```

---

## 7. 리소스 관리 및 자원 회수

### 7.1 인스턴스 기반 자원 관리

OpenCode의 자원 관리는 **Instance** 패턴을 중심으로 설계되어 있습니다:

```typescript
// 인스턴스별 상태 생성 - dispose 콜백 지정
const state = Instance.state(
  // 초기화 함수
  async () => {
    const clients: Record<string, MCPClient> = {}
    // 리소스 생성...
    return { clients }
  },
  // dispose 함수 - 인스턴스 종료 시 호출
  async (state) => {
    await Promise.all(
      Object.values(state.clients).map(client => 
        client.close().catch(error => {
          log.error("Failed to close MCP client", { error })
        })
      )
    )
  }
)
```

### 7.2 PTY 세션 자원 관리

```typescript
// packages/opencode/src/pty/index.ts
const state = Instance.state(
  () => new Map<string, ActiveSession>(),
  async (sessions) => {
    // 인스턴스 dispose 시 모든 PTY 세션 정리
    for (const session of sessions.values()) {
      try {
        session.process.kill()  // 프로세스 종료
      } catch {}
      for (const ws of session.subscribers) {
        ws.close()  // WebSocket 연결 종료
      }
    }
    sessions.clear()
  },
)
```

### 7.3 Defer 패턴 (using 문법)

```typescript
// packages/opencode/src/util/defer.ts
export function defer<T extends () => void | Promise<void>>(fn: T) {
  return {
    [Symbol.dispose]() { fn() },
    [Symbol.asyncDispose]() { return Promise.resolve(fn()) },
  }
}

// 사용 예시 - 취소 함수가 스코프 종료 시 자동 호출
export const loop = async (sessionID) => {
  const abort = start(sessionID)
  using _ = defer(() => cancel(sessionID))  // 자동 정리
  
  // 루프 로직...
}
```

### 7.4 Read/Write Lock

```typescript
// packages/opencode/src/util/lock.ts
export namespace Lock {
  // 키별로 읽기/쓰기 락 관리
  const locks = new Map<string, {
    readers: number
    writer: boolean
    waitingReaders: (() => void)[]
    waitingWriters: (() => void)[]
  }>()
  
  // 읽기 락 - 여러 읽기 동시 허용
  export async function read(key: string): Promise<Disposable>
  
  // 쓰기 락 - 독점적 접근
  export async function write(key: string): Promise<Disposable>
}

// Storage에서 사용
export async function read<T>(key: string[]) {
  using _ = await Lock.read(target)  // 자동 해제
  return await Bun.file(target).json()
}

export async function write<T>(key: string[], content: T) {
  using _ = await Lock.write(target)  // 자동 해제
  await Bun.write(target, JSON.stringify(content, null, 2))
}
```

---

## 8. 병렬 처리 및 동시성

### 8.1 AsyncQueue

```typescript
// packages/opencode/src/util/queue.ts
export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = []
  private resolvers: ((value: T) => void)[] = []
  
  push(item: T) {
    const resolve = this.resolvers.shift()
    if (resolve) resolve(item)
    else this.queue.push(item)
  }
  
  async next(): Promise<T> {
    if (this.queue.length > 0) return this.queue.shift()!
    return new Promise(resolve => this.resolvers.push(resolve))
  }
  
  async *[Symbol.asyncIterator]() {
    while (true) yield await this.next()
  }
}
```

### 8.2 Work Pool

```typescript
// 동시성 제한된 병렬 처리
export async function work<T>(
  concurrency: number, 
  items: T[], 
  fn: (item: T) => Promise<void>
) {
  const pending = [...items]
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const item = pending.pop()
        if (item === undefined) return
        await fn(item)
      }
    }),
  )
}
```

### 8.3 MCP 클라이언트 병렬 초기화

```typescript
// MCP 서버들 병렬 연결
await Promise.all(
  Object.entries(config).map(async ([key, mcp]) => {
    const result = await create(key, mcp).catch(() => undefined)
    if (!result) return
    
    status[key] = result.status
    if (result.mcpClient) {
      clients[key] = result.mcpClient
    }
  }),
)
```

### 8.4 도구 병렬 초기화

```typescript
// 모든 도구 병렬 초기화
const result = await Promise.all(
  tools.map(async (t) => {
    using _ = log.time(t.id)  // 성능 측정
    return {
      id: t.id,
      ...(await t.init({ agent })),
    }
  }),
)
```

---

## 9. 백그라운드 처리

### 9.1 세션 제목 생성 (Background)

```typescript
// ensureTitle은 백그라운드에서 실행 (await 없음)
if (step === 1)
  ensureTitle({
    session,
    modelID: lastUser.model.modelID,
    providerID: lastUser.model.providerID,
    history: msgs,
  })  // <- await 없이 호출하여 백그라운드 실행
```

### 9.2 세션 공유 (Background)

```typescript
// 세션 생성 시 자동 공유 (백그라운드)
if (!result.parentID && (Flag.OPENCODE_AUTO_SHARE || cfg.share === "auto"))
  share(result.id)
    .then((share) => {
      update(result.id, (draft) => {
        draft.share = share
      })
    })
    .catch(() => {
      // 공유 오류 무시
    })
```

### 9.3 이벤트 버스 시스템

```typescript
// packages/opencode/src/bus/index.ts
export namespace Bus {
  export async function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ) {
    const payload = { type: def.type, properties }
    const pending = []
    
    // 구독자들에게 비동기 발행
    for (const key of [def.type, "*"]) {
      const match = state().subscriptions.get(key)
      for (const sub of match ?? []) {
        pending.push(sub(payload))  // 비동기 처리
      }
    }
    
    // 글로벌 버스에도 발행 (인스턴스 간 통신)
    GlobalBus.emit("event", {
      directory: Instance.directory,
      payload,
    })
    
    return Promise.all(pending)
  }
}
```

### 9.4 SSE (Server-Sent Events) 스트리밍

```typescript
// 실시간 이벤트 스트리밍
.get("/global/event", async (c) => {
  return streamSSE(c, async (stream) => {
    const handler = (event) => {
      stream.writeSSE({ data: JSON.stringify(event) })
    }
    GlobalBus.on("event", handler)
    
    // 30초마다 하트비트 전송
    const heartbeat = setInterval(() => {
      stream.writeSSE({ data: JSON.stringify({ type: "heartbeat" }) })
    }, 30_000)
    
    // 연결 종료 대기
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        GlobalBus.off("event", handler)
        resolve()
      })
    })
  })
})
```

---

## 10. 인프라 및 배포

### 10.1 SST 구성

```typescript
// sst.config.ts
export default $config({
  app(input) {
    return {
      name: "opencode",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",  // Cloudflare 사용
      providers: {
        stripe: { apiKey: process.env.STRIPE_SECRET_KEY! },
        planetscale: "0.4.1",
      },
    }
  },
  async run() {
    await import("./infra/app.js")      // API, Web, WebApp
    await import("./infra/console.js")  // 콘솔 대시보드
    await import("./infra/enterprise.js") // 엔터프라이즈 기능
  },
})
```

### 10.2 인프라 구성 요소

```
┌───────────────────────────────────────────────────────────────────┐
│                        Cloudflare                                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                      Workers                                 │  │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐               │  │
│  │  │    API    │  │   Auth    │  │  Console  │               │  │
│  │  │  Worker   │  │  Worker   │  │ (Solid)   │               │  │
│  │  └───────────┘  └───────────┘  └───────────┘               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Static Sites                                               │  │
│  │  ┌───────────┐  ┌───────────┐                              │  │
│  │  │   Docs    │  │  Web App  │                              │  │
│  │  │  (Astro)  │  │           │                              │  │
│  │  └───────────┘  └───────────┘                              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │   Buckets    │  │      KV      │                              │
│  └──────────────┘  └──────────────┘                              │
└───────────────────────────────────────────────────────────────────┘
                                │
                                ├── PlanetScale (MySQL)
                                └── Stripe (결제)
```

### 10.3 도메인 구성

| 서브도메인 | 서비스 |
|-----------|--------|
| `api.opencode.ai` | API Worker |
| `auth.opencode.ai` | Auth Worker |
| `docs.opencode.ai` | 문서 사이트 (Astro) |
| `app.opencode.ai` | 웹 앱 |
| `opencode.ai` | 콘솔 (SolidStart) |

---

## 11. 플러그인 시스템

### 11.1 플러그인 구조

```typescript
// packages/opencode/src/plugin/index.ts
export namespace Plugin {
  // 빌트인 플러그인
  const BUILTIN = [
    "opencode-anthropic-auth@0.0.9", 
    "@gitlab/opencode-gitlab-auth@1.3.0"
  ]
  
  // 내부 플러그인 (직접 임포트)
  const INTERNAL_PLUGINS: PluginInstance[] = [
    CodexAuthPlugin, 
    CopilotAuthPlugin
  ]
  
  // 플러그인 로드 및 초기화
  const state = Instance.state(async () => {
    const hooks: Hooks[] = []
    const input: PluginInput = {
      client,       // OpenCode SDK 클라이언트
      project,      // 프로젝트 정보
      worktree,     // 작업 트리 경로
      directory,    // 현재 디렉토리
      serverUrl,    // 서버 URL
      $: Bun.$,     // Bun 셸
    }
    
    // 플러그인 초기화...
    return { hooks, input }
  })
  
  // 훅 트리거
  export async function trigger<Name>(
    name: Name, 
    input: Input, 
    output: Output
  ): Promise<Output> {
    for (const hook of await state().then(x => x.hooks)) {
      const fn = hook[name]
      if (!fn) continue
      await fn(input, output)
    }
    return output
  }
}
```

### 11.2 사용 가능한 훅

| 훅 이름 | 설명 |
|---------|------|
| `experimental.text.complete` | 텍스트 완료 후 처리 |
| `experimental.chat.messages.transform` | 메시지 변환 |
| `experimental.session.compacting` | 컨텍스트 압축 커스터마이징 |
| `tool.execute.before` | 도구 실행 전 |
| `tool.execute.after` | 도구 실행 후 |
| `config` | 설정 로드 시 |
| `event` | 이벤트 발행 시 |
| `auth` | 인증 관련 |
| `tool` | 커스텀 도구 추가 |

---

## 12. MCP (Model Context Protocol)

### 12.1 MCP 아키텍처

```typescript
// packages/opencode/src/mcp/index.ts
export namespace MCP {
  // MCP 서버 상태
  export const Status = z.discriminatedUnion("status", [
    z.object({ status: z.literal("connected") }),
    z.object({ status: z.literal("disabled") }),
    z.object({ status: z.literal("failed"), error: z.string() }),
    z.object({ status: z.literal("needs_auth") }),
    z.object({ status: z.literal("needs_client_registration"), error: z.string() }),
  ])
  
  // MCP 클라이언트 상태 관리 (인스턴스별)
  const state = Instance.state(
    async () => {
      const clients: Record<string, MCPClient> = {}
      const status: Record<string, Status> = {}
      
      // 설정된 MCP 서버들에 병렬 연결
      await Promise.all(
        Object.entries(config).map(async ([key, mcp]) => {
          const result = await create(key, mcp).catch(() => undefined)
          if (!result) return
          status[key] = result.status
          if (result.mcpClient) clients[key] = result.mcpClient
        }),
      )
      
      return { status, clients }
    },
    async (state) => {
      // 인스턴스 종료 시 모든 MCP 클라이언트 정리
      await Promise.all(
        Object.values(state.clients).map(client =>
          client.close().catch(() => {})
        ),
      )
    },
  )
}
```

### 12.2 지원하는 MCP 연결 유형

| 유형 | 설명 |
|------|------|
| `remote` | HTTP/SSE 기반 원격 서버 (OAuth 지원) |
| `local` | stdio 기반 로컬 프로세스 |

### 12.3 MCP 도구 통합

```typescript
// MCP 도구를 AI SDK 도구로 변환
async function convertMcpTool(mcpTool, client, timeout): Promise<Tool> {
  return dynamicTool({
    description: mcpTool.description ?? "",
    inputSchema: jsonSchema(schema),
    execute: async (args) => {
      return client.callTool({
        name: mcpTool.name,
        arguments: args,
      }, CallToolResultSchema, {
        resetTimeoutOnProgress: true,
        timeout,
      })
    },
  })
}
```

---

## 13. 권한 시스템

### 13.1 권한 규칙 구조

```typescript
// packages/opencode/src/permission/next.ts
export namespace PermissionNext {
  // 권한 액션
  export const Action = z.enum(["allow", "deny", "ask"])
  
  // 권한 규칙
  export const Rule = z.object({
    permission: z.string(),  // 권한 이름 (예: "edit", "bash")
    pattern: z.string(),     // 패턴 (예: "*.md", "/tmp/*")
    action: Action,          // allow, deny, ask
  })
  
  // 규칙 세트
  export type Ruleset = Rule[]
}
```

### 13.2 권한 평가 로직

```typescript
export function evaluate(
  permission: string, 
  pattern: string, 
  ...rulesets: Ruleset[]
): Rule {
  const merged = merge(...rulesets)
  // 마지막으로 매칭되는 규칙 반환 (우선순위: 나중에 정의된 것)
  const match = merged.findLast(
    (rule) => 
      Wildcard.match(permission, rule.permission) && 
      Wildcard.match(pattern, rule.pattern),
  )
  return match ?? { action: "ask", permission, pattern: "*" }
}
```

### 13.3 권한 요청 플로우

```
도구 실행 시작
      │
      ▼
┌───────────────────────┐
│   권한 규칙 평가       │
│   evaluate()          │
└───────────────────────┘
      │
      ├── action="allow" → 실행 계속
      ├── action="deny"  → DeniedError 발생
      └── action="ask"   → 사용자에게 질문
                │
                ▼
       ┌─────────────────┐
       │  Bus.publish    │
       │(Permission.Asked)│
       └─────────────────┘
                │
                ▼
       [UI에서 사용자 응답 대기]
                │
                ├── "once"   → 이번만 허용
                ├── "always" → 항상 허용 (규칙 추가)
                └── "reject" → RejectedError 발생
```

---

## 14. 스냅샷 및 버전 관리

### 14.1 스냅샷 시스템

OpenCode는 별도의 Git 저장소를 사용하여 모든 변경사항을 추적합니다:

```typescript
// packages/opencode/src/snapshot/index.ts
export namespace Snapshot {
  // 현재 상태 스냅샷 생성
  export async function track() {
    if (Instance.project.vcs !== "git") return
    
    const git = gitdir()  // ~/.opencode/snapshot/{project-id}
    
    // 스냅샷 git 저장소 초기화
    if (await fs.mkdir(git, { recursive: true })) {
      await $`git init`.env({ GIT_DIR: git, GIT_WORK_TREE: worktree })
    }
    
    // 모든 파일 스테이징 및 트리 작성
    await $`git add .`
    const hash = await $`git write-tree`
    
    return hash.trim()
  }
  
  // 스냅샷 복원
  export async function restore(snapshot: string) {
    await $`git read-tree ${snapshot} && git checkout-index -a -f`
  }
  
  // 스냅샷 간 차이 비교
  export async function patch(hash: string): Promise<Patch>
  export async function diff(hash: string): string
  export async function diffFull(from, to): Promise<FileDiff[]>
  
  // 변경사항 되돌리기
  export async function revert(patches: Patch[])
}
```

### 14.2 스냅샷 활용

```typescript
// 각 스텝 시작 시 스냅샷 생성
case "start-step":
  snapshot = await Snapshot.track()
  await Session.updatePart({
    type: "step-start",
    snapshot,
    // ...
  })
  break

// 스텝 종료 시 패치 기록
case "finish-step":
  if (snapshot) {
    const patch = await Snapshot.patch(snapshot)
    if (patch.files.length) {
      await Session.updatePart({
        type: "patch",
        hash: patch.hash,
        files: patch.files,
      })
    }
  }
  break
```

---

## 15. 컨텍스트 압축 (Compaction)

### 15.1 오버플로우 감지

```typescript
// packages/opencode/src/session/compaction.ts
export async function isOverflow(input: { 
  tokens: MessageV2.Assistant["tokens"]; 
  model: Provider.Model 
}) {
  const config = await Config.get()
  if (config.compaction?.auto === false) return false
  
  const context = input.model.limit.context
  const count = input.tokens.input + input.tokens.cache.read + input.tokens.output
  const output = Math.min(input.model.limit.output, OUTPUT_TOKEN_MAX)
  const usable = input.model.limit.input || context - output
  
  return count > usable
}
```

### 15.2 가지치기 (Pruning)

오래된 도구 호출 결과를 삭제하여 토큰 절약:

```typescript
export async function prune(input: { sessionID: string }) {
  const PRUNE_PROTECT = 40_000  // 최근 40K 토큰 보호
  const PRUNE_MINIMUM = 20_000  // 최소 20K 토큰 절약 필요
  
  // 뒤에서부터 도구 호출 스캔
  for (let msgIndex = msgs.length - 1; msgIndex >= 0; msgIndex--) {
    // 최근 2턴은 건너뜀
    // PRUNE_PROTECT 토큰 이후의 도구 출력 삭제 대상으로 마킹
  }
  
  if (pruned > PRUNE_MINIMUM) {
    for (const part of toPrune) {
      part.state.time.compacted = Date.now()  // 출력 삭제됨 표시
      await Session.updatePart(part)
    }
  }
}
```

### 15.3 컨텍스트 요약

컨텍스트 오버플로우 시 전체 대화를 요약:

```typescript
export async function process(input) {
  // compaction 에이전트로 요약 생성
  const msg = await Session.updateMessage({
    agent: "compaction",
    summary: true,  // 이 메시지가 요약임을 표시
    // ...
  })
  
  const processor = SessionProcessor.create({ assistantMessage: msg, ... })
  
  // 기존 대화 + "요약해주세요" 프롬프트
  await processor.process({
    messages: [
      ...MessageV2.toModelMessage(input.messages),
      {
        role: "user",
        content: "Provide a detailed prompt for continuing our conversation...",
      },
    ],
    // ...
  })
}
```

---

## 부록: 주요 데이터 흐름

### A. 메시지 처리 전체 플로우

```
사용자 입력
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 1. SessionPrompt.prompt()                           │
│    └─ 사용자 메시지 생성 및 저장                      │
│    └─ Session.updateMessage()                       │
│    └─ Session.updatePart()                          │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 2. SessionPrompt.loop()                             │
│    └─ 메시지 스트림 필터링                           │
│    └─ 컨텍스트 오버플로우 체크                       │
│    └─ 도구 해결 (ToolRegistry.tools())              │
│    └─ 시스템 프롬프트 구성                           │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 3. LLM.stream()                                     │
│    └─ Provider.getLanguage() - 모델 인스턴스 획득   │
│    └─ streamText() - AI SDK 스트리밍                │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 4. SessionProcessor.process()                       │
│    └─ 스트림 이벤트 처리                             │
│       ├─ reasoning: 추론 과정 저장                  │
│       ├─ text: 텍스트 응답 저장                     │
│       ├─ tool-call: 도구 실행                       │
│       └─ finish-step: 사용량 계산, 스냅샷           │
│    └─ 오류 시 재시도 (SessionRetry)                 │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 5. 결과 처리                                        │
│    └─ "continue" → loop 계속                        │
│    └─ "compact"  → SessionCompaction.create()       │
│    └─ "stop"     → 종료 및 결과 반환                │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 6. 백그라운드 작업                                   │
│    └─ SessionSummary.summarize() - 변경 요약 계산   │
│    └─ SessionCompaction.prune() - 오래된 출력 정리  │
│    └─ ensureTitle() - 세션 제목 생성                │
└─────────────────────────────────────────────────────┘
```

---

이 문서는 OpenCode 프로젝트의 핵심 아키텍처와 구현 패턴을 상세히 설명합니다. 
추가 질문이 있으시면 코드를 직접 참조하시거나 문의해 주세요.

**최종 업데이트**: 2026-01-16
