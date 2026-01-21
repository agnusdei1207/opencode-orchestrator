# 스킬(Skills) 시스템 통합 계획

## 1. 개요 (Overview)
`../opencode` 프로젝트 분석 결과, OpenCode는 `.opencode/skills` 디렉토리 내의 `SKILL.md` 파일을 자동으로 검색하여 에이전트에게 재사용 가능한 능력을 부여하는 **네이티브 스킬 시스템**을 내장하고 있습니다.

이 시스템을 `opencode-orchestrator`에 적용하면, 사용자가 `npx skills add <repo>` 등을 통해 스킬을 추가했을 때, Orchestrator의 하위 에이전트(Planner, Worker, Reviewer)들이 이를 즉시 활용할 수 있게 됩니다.

**사용자 피드백 반영**: 사용자가 직접 설치하지 않아도, 에이전트가 필요 시 스스로 스킬을 설치(`npx skills add`)하고 사용할 수 있도록 통합합니다.

## 2. 동작 원리 (Mechanism)
OpenCode 호스트 시스템은 다음과 같이 동작합니다:
1.  **검색 (Discovery)**: `.opencode/skills/*/SKILL.md` 경로 등을 탐색하여 사용 가능한 스킬 목록을 구축합니다.
2.  **주입 (Injection)**: 에이전트 실행 시 `skill` 도구가 활성화되어 있으면, `<available_skills>` 목록을 시스템 프롬프트에 자동으로 포함시킵니다.
3.  **실행 (Execution)**: 에이전트가 `skill({ name: "..." })` 도구를 호출하면, 호스트가 해당 `SKILL.md` 내용을 읽어 에이전트에게 반환합니다.

## 3. 통합 방안 (Integration Plan)

`opencode-orchestrator`는 OpenCode의 플러그인으로서, 하위 세션(Sub-session)을 생성할 때 호스트의 `skill` 도구 사용 권한을 위임해야 합니다. 또한, 에이전트가 스킬을 스스로 설치할 수 있도록 터미널 실행 권한(`run_command`)을 보장해야 합니다.

### 단계 1: 도구 상수 업데이트
`src/shared/tool/constants/tool-names.ts`에 `SKILL` 상수를 추가합니다.

```typescript
export const TOOL_NAMES = {
    // ...
    SKILL: "skill", // 추가
    // ...
}
```

### 단계 2: 하위 에이전트 권한 부여 (핵심)
`src/core/agents/manager/task-launcher.ts`에서 하위 작업을 실행할 때 `skill` 도구와 `run_command`(설치용) 권한을 명시적으로 활성화합니다.
*참고: `Worker` 에이전트는 기본적으로 `run_command`를 가지고 있을 수 있으나, 호환성을 위해 명시적으로 확인합니다.*

```typescript
// src/core/agents/manager/task-launcher.ts

await this.client.session.prompt({
    path: { id: task.sessionID },
    body: {
        agent: task.agent,
        tools: {
            delegate_task: true,
            get_task_result: true,
            list_tasks: true,
            cancel_task: true,
            skill: true,         // 추가: 호스트의 skill 도구 활성화
            run_command: true,   // 재확인: npx skills add 실행을 위해 필요
        },
        parts: [{ type: PART_TYPES.TEXT, text: task.prompt }]
    },
});
```

### 단계 3: 에이전트 인지 (Awareness)
Worker 에이전트의 프롬프트(또는 시스템 지침)에 다음 내용을 추가하는 것을 고려합니다(선택 사항):
*"필요한 능력이 부족할 경우 `npx skills add <repo>`를 통해 스킬을 설치하고 `skill({...})` 도구를 사용하여 학습하십시오."*

## 4. 시나리오: 자율 스킬 획득 (Autonomous Skill Acquisition)
1.  Worker 에이전트가 "릴리즈 노트를 작성하라"는 임무를 받습니다.
2.  자신에게 해당 지식이 없음을 인지하고 검색을 시도하거나, `git-release` 스킬이 필요하다고 판단합니다.
3.  `run_command({ command: "npx skills add agnusdei1207/git-release" })`를 실행합니다.
4.  설치가 완료되면 `skill({ name: "git-release" })`를 호출하여 지침을 로드합니다.
5.  로드된 지침에 따라 릴리즈 노트를 작성합니다.

## 5. 승인 요청 (Approval Request)
위 방안대로 코드 수정을 진행하시겠습니까?
1. `src/shared/tool/constants/tool-names.ts` 수정
2. `src/core/agents/manager/task-launcher.ts` 수정
