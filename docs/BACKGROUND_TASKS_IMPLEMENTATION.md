# 백그라운드 작업 기능 구현 문서

> 작성일: 2026-01-15
> 상태: ✅ 완료
> 테스트: 2026-01-15 - TypeScript 및 Rust 모두 통과

## 📋 개요

`opencode-orchestrator`는 **백그라운드 작업 실행 및 모니터링** 기능을 제공합니다. 이를 통해 AI가 긴 빌드, 테스트, 또는 기타 명령어를 백그라운드에서 실행하고 나중에 결과를 확인할 수 있습니다.

### 기대 효과
- 긴 빌드/테스트 명령어를 백그라운드로 실행하여 효율성 향상
- 여러 작업을 병렬로 실행 가능
- Agent가 대기 시간 없이 다른 분석 작업 수행 가능

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    OpenCode Orchestrator                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   TypeScript Layer (Plugin)                                      │
│   ├── BackgroundTaskManager (src/core/background.ts)            │
│   │   └── In-memory task tracking                                │
│   │   └── Node.js child_process for execution                   │
│   │                                                               │
│   ├── Tools (src/tools/background.ts)                            │
│   │   └── run_background                                          │
│   │   └── check_background                                        │
│   │   └── list_background                                         │
│   │   └── kill_background                                         │
│   │                                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   Rust Layer (High-Performance Native)                           │
│   ├── orchestrator-core/src/background.rs                        │
│   │   └── File-based state persistence                           │
│   │   └── Native process spawning                                 │
│   │                                                               │
│   ├── orchestrator-cli/src/tools.rs                              │
│   │   └── MCP tools for background operations                    │
│   │   └── Same API as TypeScript                                  │
│   │                                                               │
│   State: /tmp/opencode-orchestrator/bg_tasks.json                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 사용 가능한 도구들

### 1. `run_background`

명령어를 백그라운드에서 실행하고 즉시 Task ID를 반환합니다.

**입력:**
```typescript
{
  command: "npm run build",     // 실행할 명령어
  cwd?: "/path/to/dir",         // 작업 디렉토리 (기본: 프로젝트 루트)
  timeout?: 300000,             // 타임아웃 ms (기본: 5분)
  label?: "Build project"       // 선택적 라벨
}
```

**출력:**
```
🚀 **Background Task Started** (Build project)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Property      | Value |
|---------------|-------|
| **Task ID**   | `bg_a1b2c3d4` |
| **Command**   | `npm run build` |
| **Status**    | ⏳ running |
| **Working Dir** | /project |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 **Next Step**: Use `check_background` with task ID `bg_a1b2c3d4` to get results.
```

### 2. `check_background`

Task ID로 실행 상태와 출력을 확인합니다.

**입력:**
```typescript
{
  taskId: "bg_a1b2c3d4",
  tailLines?: 50  // 선택: 출력의 마지막 N줄만 표시
}
```

**출력 (완료):**
```
✅ **Task bg_a1b2c3d4** (Build project)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Property      | Value |
|---------------|-------|
| **Command**   | `npm run build` |
| **Status**    | ✅ **DONE** |
| **Duration**  | 45.3s |
| **Exit Code** | 0 |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 **Output (stdout)**:
​```
[build output here...]
​```
```

### 3. `list_background`

모든 백그라운드 작업 목록을 조회합니다.

**입력:**
```typescript
{
  status?: "all" | "running" | "done" | "error"
}
```

**출력:**
```
📋 **Background Tasks** (3 total)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| ⏳ Running: 1 | ✅ Done: 2 | ❌ Error/Timeout: 0 |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Task ID | Status | Command | Duration |
|---------|--------|---------|----------|
| `bg_a1b2c3d4` | ✅ done    | npm run build... | 45.3s    |
| `bg_e5f6g7h8` | ⏳ running | npm test...      | 12.1s... |

💡 Use `check_background({ taskId: "bg_xxxxx" })` to see full output.
```

### 4. `kill_background`

실행 중인 백그라운드 작업을 강제 종료합니다.

**입력:**
```typescript
{
  taskId: "bg_e5f6g7h8"
}
```

**출력:**
```
🛑 Task `bg_e5f6g7h8` has been killed.
Command: `npm test`
Duration before kill: 15.2s
```

---

## 📂 관련 파일

### TypeScript 구현
| 파일 | 설명 |
|------|------|
| `src/core/background.ts` | BackgroundTaskManager 클래스 (싱글톤) |
| `src/tools/background.ts` | 도구 정의 (run, check, list, kill) |
| `src/index.ts` | 플러그인 메인 엔트리 (도구 등록) |

### Rust 구현 (Native Performance)
| 파일 | 설명 |
|------|------|
| `crates/orchestrator-core/src/background.rs` | 백그라운드 매니저 (파일 기반 상태) |
| `crates/orchestrator-cli/src/tools.rs` | MCP 도구 구현 |
| `crates/orchestrator-cli/src/main.rs` | tools/list에 스키마 등록 |

### 테스트
| 파일 | 설명 |
|------|------|
| `scripts/test-background.ts` | TypeScript 구현 테스트 |
| `scripts/test-rust-background.ts` | Rust 구현 테스트 |

---

## 🔧 구현 원리

### TypeScript 방식 (현재 활성)

1. **BackgroundTaskManager** 싱글톤이 모든 작업을 메모리에서 관리
2. `child_process.spawn()`으로 명령어 실행
3. stdout/stderr를 비동기로 수집
4. 타임아웃 시 `SIGKILL`로 프로세스 종료

```typescript
// 핵심 로직
const proc = spawn(shell, ["-c", command], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
});

proc.stdout.on("data", (data) => { task.output += data; });
proc.stderr.on("data", (data) => { task.errorOutput += data; });

proc.on("close", (code) => {
    task.exitCode = code;
    task.status = code === 0 ? "done" : "error";
});
```

### Rust 방식 (고성능)

1. **파일 기반 상태 저장**: `/tmp/opencode-orchestrator/bg_tasks.json`
2. `std::process::Command`로 명령어 실행
3. 별도 스레드에서 출력 수집 및 상태 업데이트
4. MCP JSON-RPC를 통해 도구 노출

```rust
// 핵심 로직
let child = Command::new("/bin/sh")
    .arg("-c")
    .arg(command)
    .current_dir(&working_dir)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;

std::thread::spawn(move || {
    // 출력 수집 및 상태 업데이트
    let result = child.wait();
    // 상태 파일에 결과 저장
});
```

---

## 🧪 테스트 결과

### TypeScript 테스트 (`scripts/test-background.ts`)
```
🧪 Testing Background Task Manager

📋 Test 1: Quick echo command
   Status: done ✅
   Output: Hello from background!

📋 Test 2: Multiple concurrent tasks
   task2 (slow): running ⏳
   task3 (fast): done ✅

📋 Test 3: Waiting for slow task
   Completed in 2.01s ✅

📋 Test 5: Error handling
   Status: error ✅
   Error message captured correctly

📊 Final Summary:
   Total tasks: 4
   ✅ Done: 3
   ❌ Error: 1 (expected)
```

### Rust 테스트 (`cargo test background`)
```
running 3 tests
test background::tests::test_error_command ... ok
test background::tests::test_list_tasks ... ok
test background::tests::test_run_simple_command ... ok

test result: ok. 3 passed; 0 failed; 0 ignored
```

---

## 💡 사용 예시

### AI가 빌드와 테스트를 병렬로 실행

```
1. run_background({ command: "npm run build", label: "Build" })
   → 🚀 Task bg_001 started

2. run_background({ command: "npm test", label: "Test" })
   → 🚀 Task bg_002 started

3. (AI가 코드 분석 등 다른 작업 수행)

4. list_background({})
   → 📋 2 tasks: bg_001 done, bg_002 running

5. check_background({ taskId: "bg_001" })
   → ✅ Build completed successfully

6. check_background({ taskId: "bg_002" })
   → ✅ All tests passed
```

---

## 🐛 디버그 모드

TypeScript 구현에서는 디버그 모드가 활성화되어 있어 콘솔에 다음과 같은 로그가 출력됩니다:

```
[BG-DEBUG 01:04:11.208] bg_1bd442dc: Starting: echo 'Hello' (cwd: /project)
[BG-DEBUG 01:04:11.213] bg_1bd442dc: stdout: Hello
[BG-DEBUG 01:04:11.214] bg_1bd442dc: Completed with code 0 in 0.01s
```

Rust 구현에서는 `RUST_LOG=debug` 환경 변수로 디버그 출력을 활성화할 수 있습니다.
