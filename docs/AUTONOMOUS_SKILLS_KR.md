# 자율 스킬 획득 시스템 (Autonomous Skill Acquisition)

이 문서는 OpenCode Orchestrator의 에이전트(Worker, Planner 등)가 외부의 도움 없이 스스로 필요한 스킬을 **찾고(Search), 설치하고(Install), 배워서(Learn), 실행(Execute)**하는 과정을 설명합니다.

---

## 1. 개요 (Concept)

기존의 에이전트는 사전에 정의된 도구와 지식만 사용할 수 있었습니다.
하지만 **자율 스킬 획득 시스템**이 적용된 Orchestrator의 에이전트는 "모르는 것"을 마주했을 때 멈추지 않고, 마치 개발자가 라이브러리를 찾아보듯 스스로 능력을 확장합니다.

## 2. 동작 프로세스 (Workflow)

에이전트는 다음 5단계의 사고 및 행동 과정을 거쳐 새로운 능력을 획득합니다.

### 1단계: 인지 (Awareness) & 검색 (Search)
*   **상황**: 사용자가 "AWS에 배포해줘"라고 요청했지만, 에이전트는 AWS 배포 방법을 모릅니다.
*   **판단**: "나는 AWS 배포 방법을 모른다. 하지만 OpenCode Skills 저장소에 관련 스킬이 있을 것이다."
*   **행동**: 필요하다면 웹 검색이나 내부 지식을 통해 적절한 스킬 저장소(`owner/repo`)를 파악합니다.

### 2단계: 설치 (Acquisition)
*   **판단**: "`agnusdei1207/aws-deploy` 스킬이 적절해보인다. 설치하자."
*   **행동**: `run_command` 도구를 사용하여 스스로 설치 명령어를 실행합니다.
    ```bash
    npx skills add agnusdei1207/aws-deploy
    ```
*   **권한**: 시스템은 하위 에이전트에게 이 명령어를 실행할 권한(`run_command`)을 미리 부여했습니다.

### 3단계: 학습 (Ingestion)
*   **상황**: 설치가 완료되었습니다. 하지만 아직 *사용법*은 모릅니다.
*   **행동**: `skill` 도구를 호출하여 설치된 스킬의 메뉴얼(`SKILL.md`)을 읽어들입니다.
    ```javascript
    skill({ name: "aws-deploy" })
    ```
*   **결과**: OpenCode 호스트가 해당 스킬의 설명, 사용법, 주의사항을 에이전트의 컨텍스트(Context)에 주입합니다.

### 4단계: 적응 (Adaptation)
*   **판단**: "아하, 이 스킬을 쓰려면 `aws_deploy_function` 도구를 이런 파라미터로 호출해야 하는구나."
*   **행동**: 에이전트는 방금 읽은 지침을 자신의 단기 기억에 통합하고, 작업 계획을 수정합니다.

### 5단계: 실행 (Execution)
*   **행동**: 새로 배운 도구와 지식을 활용하여 원래의 목표(AWS 배포)를 수행합니다.

---

## 3. 기술적 구현 (Technical Implementation)

이 시스템을 가능하게 하는 3가지 기술적 기둥은 다음과 같습니다.

### A. 프롬프트 엔지니어링 (Prompt Engineering)
`src/agents/prompts/common/skills.ts`에 정의된 **`<skills_capabilities>`** 섹션이 에이전트에게 다음과 같이 지시합니다:
> "모르는 작업이 있다면 주저하지 말고 `npx skills add`로 스킬을 설치하고 `skill()` 도구로 배워서 해결하라. 사용자에게 허락을 구할 필요 없다."

### B. 권한 위임 (Permission Delegation)
`task-launcher.ts`에서 하위 에이전트를 생성할 때 다음 두 가지 권한을 필수적으로 부여합니다:
1.  **`skill: true`**: 설치된 스킬의 내용을 읽어오는 도구.
2.  **`run_command: true`**: `npx` 명령어를 통해 스킬을 설치하는 도구.

### C. 호스트 통합 (Host Integration)
OpenCode 호스트(Client)는 에이전트가 요청한 `skill()` 호출을 가로채서 로컬 파일시스템의 `.opencode/skills/.../SKILL.md` 내용을 읽어 에이전트에게 텍스트로 반환해줍니다.

---

## 4. 예시 시나리오 (Example)

**사용자 요청**: "이 프로젝트의 릴리즈 노트를 작성해줘."
**(에이전트는 릴리즈 노트 작성 규칙을 모름)**

1.  **Worker**: "릴리즈 노트 작성법을 모르겠군. `git-release` 스킬이 필요해."
2.  **Worker**: `run_command("npx skills add agnusdei1207/git-release")` 실행.
3.  **System**: 설치 완료.
4.  **Worker**: `skill({ name: "git-release" })` 실행.
5.  **System**: (SKILL.md 내용을 반환: "PR 제목을 기반으로 작성하고, 버전은 Semantic Versioning을 따르라...")
6.  **Worker**: "알겠다. 배운 대로 릴리즈 노트를 작성하겠다." (작업 수행)
