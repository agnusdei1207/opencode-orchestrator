---
title: "PLAN: OpenCode Second Brain & Autonomous Knowledge Graph RAG Integration"
tags: [knowledge-rag, second-brain, memory-consolidation, multi-agent]
created: 2026-05-31
version: 1.2.71
status: in-progress
---

# PLAN: OpenCode Second Brain & Autonomous Knowledge Graph RAG Integration

이 문서는 `opencode-orchestrator` 프레임워크에 Obsidian 스타일의 인메모리 지식 그래프 RAG와 에이전트 자율 메모리 관리 라이프사이클을 실전 이식하기 위한 **아키텍처 로드맵 및 히스토리 계획서**입니다.

---

## 🔗 관련 문서 및 위키링크 (Obsidian Wiki-Links)
* **상위 마일스톤**: [[Core-Architecture-MOC]]
* **최근 릴리즈 내역**: [[1.2.71-Release-Notes]]
* **구현 세부 정보**: `src/core/knowledge/tag-indexer.ts` ➡️ [[TagIndexer-Implementation]]
* **다음 마이크로 태스크**: `src/core/knowledge/graph-parser.ts` ➡️ [[GraphParser-Design]]

---

## 📌 1. 프로젝트 전수조사 및 1.2.71 릴리즈 완수 이력

### 1-1. 1.2.71 패치 버전 배포 성공 (2026-05-31 완료)
* **핵심 해결**: 윈도우 호스트 파일시스템 I/O 개행문자(`\r\n`)로 인한 리드미 싱크 크래시 디버깅 및 복구 완료.
* **Rust 바이너리 컴파일**: WSL Docker 크로스 컴파일 컨테이너를 가동하여 5대 플랫폼 바이너리 전원 무결성 빌딩 성공.
  - `bin/orchestrator-linux-x64` (Verified 5.2MB, includes the Linux x64 packaging fix)
  - `bin/orchestrator-linux-arm64` (Verified 5.0MB)
* **NPM 수동 릴리즈**: 신규 Classic Token (`npm_ZuHY...`) 주입을 바탕으로 퍼블릭 배포 완수 및 자격증명 `.npmrc` 완전 영구 소각 완료.
* **CI/CD 고도화**: `.github/workflows/release.yml`에 공식 NPM 레지스트리 자동 배포 스테이지 이식 완료.

---

## 🏗️ 2. Obsidian 지식 RAG 도입 계획 및 아키텍처

TypeScript ESM 아키텍처 위에서 작동하는 초고속 지식 그래프 횡단 평면을 설계합니다.

```text
               +-------------------------------------------+
               |     docs/knowledge/ (Structured Vault)    |
               +---------------------┬---------------------+
                                     |
                                     ▼ (O(1) Tag HashMap)
               +-------------------------------------------+
               |  [Phase 1] tag-indexer.ts (완료)           |
               +---------------------┬---------------------+
                                     |
                                     ▼ (Wiki-Links & Adjacency)
               +-------------------------------------------+
               |  [Phase 2] graph-parser.ts (진행 중)       |
               +---------------------┬---------------------+
                                     |
                                     ▼ (BM25 + Cosine Vector + 2-Hop Traverse)
               +-------------------------------------------+
               |  [Phase 3] hybrid-search.ts               |
               +-------------------------------------------+
```

### 2-1. 단계별 마이크로 로드맵
1. **[x] Phase 1: TagIndexer 구현**: YAML Frontmatter 파서, 태그 인덱스 빌더, `getFilesWithAllTags` 등의 고속 쿼리셋 개발 완료 및 단위 테스트 통과.
2. **[/] Phase 2: Wiki-Links & Backlinks**: 마크다운 내 `[[Note]]` 와 `[Note](./file.md)` 관계를 추출해 양방향 인접 리스트 지식 그래프 구축. 타깃 파일 하단에 `## 🔗 Backlinks` 자동 동기화 주입.
3. **[ ] Phase 3: Triple-Engine Hybrid Search & RRF**: 어휘 FTS + 로컬 코사인 유사도 벡터 + 그래프 2-Hop 횡단 검색을 Reciprocal Rank Fusion (RRF) 공식으로 융합하는 랭킹 엔진 구현.
4. **[ ] Phase 4: Scratchpad Registers**: 에이전트 전용 초고속 레지스터 캐시(`docs/brain/scratchpad.md`) 및 Obsidian Canvas (.canvas) 자율 드로잉 모듈 탑재.
5. **[ ] Phase 5: Multi-Agent Context Injection**: 매 턴 사고 루프 시작 시 `system-transform-handler.ts`를 통해 에이전트에 지식 RAG 평면 동적 투입.
6. **[ ] Phase 6: 3대 초강력 안정성 가드**:
   - DFS/BFS 순환 링크 스택 오버플로우 방지 (Max 2-Hop 깊이 락)
   - 동시 비동기 쓰기 충돌 방지 (FIFO 쓰기 대기 큐)
   - 자율 파기 제어 가드 (Pinning `keep: true` 방어막)
7. **[ ] Phase 7: Memory Consolidation**: 크기 초과 노트 자율 분단(Fission), 유사 노트 통합 및 MOC 빌딩(Fusion), Orphan 고립 노드 격리 아카이빙(GC).

---

## 🔗 Backlinks

*아직 양방향 그래프 엔진 가동 전이므로 수동으로 구조화해 둡니다.*
- [[1.2.71-Release-Notes]]
- [[TagIndexer-Implementation]]
