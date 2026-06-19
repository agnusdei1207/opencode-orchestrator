# 지식 저장소 & 검색 시스템 — 기술 심층 분석

> **대상 독자**: opencode-orchestrator의 검색 파이프라인을 이해하고자 하는 개발자·연구자
> **마지막 업데이트**: 2026-06-19
> **소스 경로**: `src/core/knowledge/`

---

## 목차

1. [전체 구조 한눈에](#1-전체-구조-한눈에)
2. [마크다운 파싱과 인덱싱](#2-마크다운-파싱과-인덱싱)
3. [태그 시스템](#3-태그-시스템)
4. [위키링크 그래프](#4-위키링크-그래프)
5. [BM25 키워드 검색](#5-bm25-키워드-검색)
6. [태그 검색](#6-태그-검색)
7. [그래프 검색 — 2-hop BFS](#7-그래프-검색--2-hop-bfs)
8. [RRF 하이브리드 합의](#8-rrf-하이브리드-합의)
9. [역할별 검색 가중치](#9-역할별-검색-가중치)
10. [메모리 수평선 (Memory Horizon)](#10-메모리-수평선-memory-horizon)
11. [신경망 임베딩과의 비교](#11-신경망-임베딩과의-비교)
12. [한계와 향후 고도화 방향](#12-한계와-향후-고도화-방향)

---

## 1. 전체 구조 한눈에

아래 ASCII 다이어그램은 마크다운 파일이 검색 결과로 변환되기까지의 전체 흐름을 보여준다.

```
                          ┌──────────────────┐
                          │   .md 파일 수집    │
                          │ (docs/ 디렉터리)   │
                          └────────┬─────────┘
                                   │
                   ┌───────────────┼───────────────┐
                   ▼               ▼               ▼
          ┌────────────┐  ┌────────────┐  ┌────────────────┐
          │ TagIndexer │  │GraphParser │  │  HybridSearch  │
          │            │  │            │  │  .indexContent  │
          │ frontmatter│  │ wikilinks  │  │                │
          │  → tagMap  │  │  → fwd/bk  │  │  → contentMap  │
          └─────┬──────┘  └─────┬──────┘  └───────┬────────┘
                │               │                 │
                └───────────────┼─────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     search(query)     │
                    │   tokenize → terms    │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │ lexicalSearch│  │  tagSearch   │  │ graphSearch  │
     │   (BM25)     │  │ (태그 매칭)  │  │ (2-hop BFS) │
     └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
            │                 │                 │
            │  ranked list    │  ranked list    │  ranked list
            └─────────────────┼─────────────────┘
                              ▼
                   ┌──────────────────┐
                   │   fuseResults    │
                   │  (RRF, k=60)    │
                   │  × EngineWeights │
                   └────────┬─────────┘
                            ▼
                   ┌──────────────────┐
                   │  SearchResult[]  │
                   │  (top N 반환)     │
                   └──────────────────┘
```

**핵심 모듈 간 의존 관계:**

```
context-provider.ts ─── orchestrates ───→ TagIndexer
        │                                  GraphParser
        │                                  HybridSearch
        │                                  weightsForRole()
        │
        └──→ buildPrompt() → <knowledge_rag_context> XML 블록
```

**파일 구성:**

| 파일 | 역할 | 줄 수 |
|:---|:---|---:|
| `context-provider.ts` | 파일 수집 → 인덱싱 → 검색 → 프롬프트 생성 오케스트레이션 | 130 |
| `tag-indexer.ts` | YAML frontmatter 파싱, 태그 역색인 | 208 |
| `graph-parser.ts` | 위키링크·마크다운 링크 파싱, 양방향 그래프 구축 | 153 |
| `hybrid-search.ts` | BM25 + 태그 + 그래프 검색, RRF 융합 | 233 |
| `retrieval-weights.ts` | 역할별 가중치, 메모리 수평선 | 59 |
| `memory-consolidation.ts` | 그래프 유지보수(oversized·orphan·merge 감지) | 148 |
| `mission-memory.ts` | 미션 루프 상태를 마크다운 노트로 동기화 | 276 |
| `safety-guards.ts` | 순환 링크 감지, 동시 쓰기 큐, 고정(pin) 검사 | 102 |
| `scratchpad.ts` | LRU 기반 휘발성 레지스터 캐시 | 109 |
| `index.ts` | 배럴 파일(barrel export) | 22 |

---

## 2. 마크다운 파싱과 인덱싱

### 2.1 파일 수집

`KnowledgeContextProvider.collectMarkdownFiles()`
([context-provider.ts:36–46](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/context-provider.ts#L36-L46))
가 프로젝트 디렉터리 내 **두 곳**의 루트에서 `.md` 파일을 재귀적으로 수집한다.

```typescript
const KNOWLEDGE_ROOTS = ["docs", path.join(".opencode", "docs")];
const SKIP_SEGMENTS = new Set(["node_modules", "dist", "bin", ".git", "archive"]);
```

- `docs/` — 사용자 문서
- `.opencode/docs/` — 오케스트레이터 자동 생성 문서

`walkDirectory()` ([context-provider.ts:48–63](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/context-provider.ts#L48-L63))는 `SKIP_SEGMENTS`에 속하는 디렉터리를 건너뛴다. 또한 `isDirectInjectedScratchpad()`로 자동 생성된 스크래치패드 파일(`.opencode/docs/brain/scratchpad.md`)을 **중복 주입 방지**를 위해 제외한다.

### 2.2 인덱싱 파이프라인

`indexKnowledge()` ([context-provider.ts:65–90](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/context-provider.ts#L65-L90))는 수집된 각 파일에 대해 **세 단계**의 인덱싱을 수행한다:

```
파일 읽기 → parseFrontmatter() → frontmatter/body 분리
                                      │
           ┌──────────────────────────┤
           ▼                          ▼                    ▼
  tagIndexer.indexFile()    graphParser.indexFile()   search.indexContent()
  (태그 역색인 갱신)          (링크 그래프 갱신)         (본문 텍스트 저장)
```

1. **frontmatter 분리**: `TagIndexer.parseFrontmatter(content)` → `{ data, body }`
2. **태그 인덱싱**: `tagIndexer.indexFile(filePath, content)` → 태그→파일 역색인
3. **그래프 인덱싱**: `graphParser.indexFile(filePath, content)` → 양방향 링크 맵
4. **본문 등록**: `search.indexContent(noteName, normalizedBody)` → `contentMap`에 소문자 변환하여 저장

**노트 이름 규칙**: 파일 경로의 basename에서 확장자를 제거한 것이 노트 이름이 된다. 예: `/docs/architecture.md` → `architecture`

```typescript
// graph-parser.ts:21-25
public getNoteName(filePath: string): string {
    const basename = filePath.split(/[/\\]/).pop() || "";
    const dotIdx = basename.lastIndexOf(".");
    return dotIdx !== -1 ? basename.slice(0, dotIdx) : basename;
}
```

### 2.3 스니펫 생성

각 노트의 본문은 `buildSnippet()` ([context-provider.ts:92–96](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/context-provider.ts#L92-L96))으로 220자 이내의 스니펫으로 축약되어 검색 결과에 포함된다.

```typescript
const MAX_SNIPPET_CHARS = 220;

private buildSnippet(content: string): string {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (normalized.length <= MAX_SNIPPET_CHARS) return normalized;
    return `${normalized.slice(0, MAX_SNIPPET_CHARS)}...`;
}
```

---

## 3. 태그 시스템

### 3.1 Frontmatter 파싱

`TagIndexer.parseFrontmatter()` ([tag-indexer.ts:24–43](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/tag-indexer.ts#L24-L43))는 **정규식 기반**의 경량 YAML 파서다. 외부 라이브러리 의존성 없이 결정론적 오류 복구를 제공한다.

```
입력 마크다운:
  ---
  tags: [architecture, search]
  title: "Knowledge Search"
  keep: true
  ---
  # 본문 시작...

파싱 결과:
  data = { tags: ["architecture", "search"], title: "Knowledge Search", keep: true }
  body = "# 본문 시작..."
```

**파싱 로직:**

1. `^---\r?\n([\s\S]*?)\r?\n---` 정규식으로 frontmatter 블록 추출
2. 각 줄에 대해 `parseYamlLine()` 호출:
   - `key: [val1, val2]` → 인라인 배열로 파싱
   - `key: value` → `parseScalar()`로 타입 추론 (`true`/`false` → boolean, 숫자 → number)
   - `key:` (값 없음) → 빈 배열 초기화, 이후 `- item` 줄에서 추가
   - `- item` → 현재 활성 키의 배열에 추가

### 3.2 태그 역색인

`tagMap`은 `Map<string, Set<string>>` 구조로, **태그 → 파일 경로 집합**의 역색인이다.

```
tagMap:
  "architecture" → { "/docs/arch.md", "/docs/design.md" }
  "search"       → { "/docs/search.md", "/docs/hybrid.md" }
  "mission"      → { ".opencode/docs/brain/scratchpad.md" }
```

**인덱싱 과정** ([tag-indexer.ts:82–95](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/tag-indexer.ts#L82-L95)):

1. `clearIndexForFile(filePath)` — 기존 매핑 제거 (재인덱싱 시 중복 방지)
2. `parseFrontmatter(content)` — frontmatter에서 `tags` 배열 추출
3. 각 태그를 소문자로 정규화하여 `addTagEntry(tag, filePath)` 호출

### 3.3 조회 API

| 메서드 | 시간 복잡도 | 설명 |
|:---|:---:|:---|
| `getFilesWithTag(tag)` | O(1) | 단일 태그와 매칭되는 파일 집합 반환 |
| `getFilesWithAllTags(tags)` | O(n·k) | 모든 태그를 **동시에** 갖는 파일 (교집합) |
| `getFilesWithAnyTags(tags)` | O(n·k) | 하나 이상의 태그를 갖는 파일 (합집합) |
| `getAllTags()` | O(1) | 전체 태그 목록 |
| `getMetadata(filePath)` | O(1) | 캐시된 frontmatter 반환 |

**설계 의도**: `Map` + `Set` 구조를 사용하여 조회를 O(1)으로 보장하고, 재인덱싱 시 `clearIndexForFile`로 기존 엔트리를 **원자적으로** 정리한다. 빈 Set은 즉시 삭제하여 메모리 누수를 방지한다.

---

## 4. 위키링크 그래프

### 4.1 링크 추출

`GraphParser.parseLinks()` ([graph-parser.ts:30–57](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/graph-parser.ts#L30-L57))는 두 가지 링크 형식을 파싱한다:

**① 위키링크 (Obsidian 스타일)**

```
정규식: /\[\[([^\[\]|#]+)(?:\|[^\[\]]+)?(?:#[^\[\]]+)?\]\]/g
```

| 예시 | 캡처 결과 |
|:---|:---|
| `[[Architecture]]` | `Architecture` |
| `[[Architecture\|아키텍처]]` | `Architecture` (레이블 무시) |
| `[[Architecture#검색]]` | `Architecture` (섹션 앵커 무시) |

- `[^\[\]|#]+` — 대괄호·파이프·해시를 제외한 노트 이름 캡처
- `(?:\|[^\[\]]+)?` — 선택적 디스플레이 레이블 (비캡처 그룹)
- `(?:#[^\[\]]+)?` — 선택적 섹션 앵커 (비캡처 그룹)

**② 표준 마크다운 링크**

```
정규식: /\[([^\]]+)\]\(([^)]+)\)/g
```

로컬 파일만 추출하는 필터:

```typescript
// graph-parser.ts:48
if (!url.includes("://") && (url.endsWith(".md") || url.startsWith(".") || url.startsWith("/")))
```

- `://`를 포함하면 외부 URL로 판단하여 제외
- `.md` 확장자, `.` 시작(상대 경로), `/` 시작(절대 경로)만 로컬 참조로 인식

### 4.2 양방향 그래프 구조

`GraphParser`는 네 개의 `Map`으로 그래프를 관리한다:

```
forwardLinks:  noteA → { noteB, noteC }      "A가 B와 C를 참조"
backlinks:     noteB → { noteA }              "B는 A로부터 참조됨"
               noteC → { noteA }

noteToPath:    noteA → "/docs/noteA.md"
pathToNote:    "/docs/noteA.md" → noteA
```

### 4.3 인덱싱 흐름

`indexFile()` ([graph-parser.ts:62–86](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/graph-parser.ts#L62-L86)):

```
1. getNoteName(filePath) → sourceNote
2. clearIndexForNote(sourceNote)     ← 기존 forward→backlink 쌍 정리
3. parseLinks(content) → targets[]
4. forwardLinks.set(sourceNote, new Set(targets))
5. 각 target에 대해:
   backlinks[target].add(sourceNote)
```

**`clearIndexForNote()`의 역할** ([graph-parser.ts:137–151](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/graph-parser.ts#L137-L151)): 노트를 재인덱싱할 때 **이전 forward link가 가리키던 target들의 backlink 집합에서 해당 노트를 제거**한다. 이를 통해 링크 그래프의 **일관성**이 보장된다.

### 4.4 백링크 동기화

`syncBacklinksSection()` ([graph-parser.ts:113–132](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/graph-parser.ts#L113-L132))은 노트 본문의 `## 🔗 Backlinks` 섹션을 자동으로 갱신한다:

```markdown
## 🔗 Backlinks

- [[Architecture]]
- [[Design-Decisions]]
```

- 기존 섹션이 있으면 정규식으로 교체
- 없으면 파일 끝에 추가
- 빈 경우 `*(No backlinks found)*` 표시

---

## 5. BM25 키워드 검색

### 5.1 전체 흐름

`lexicalSearch()` ([hybrid-search.ts:66–89](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L66-L89))는 BM25 알고리즘에 기반한 키워드 점수를 계산한다.

```
terms[] ──→ 각 term에 대해:
            │
            ├─ documentFrequency(term) → df
            ├─ IDF 계산
            │
            └─ 각 문서에 대해:
               ├─ countOccurrences(content, term) → tf
               ├─ TF 정규화
               └─ score += IDF × tfNorm
```

### 5.2 상수

```typescript
// hybrid-search.ts:22-24
const BM25_K1 = 1.2;   // 용어 빈도 감쇠 파라미터
const BM25_B = 0.75;    // 문서 길이 정규화 가중치
```

| 상수 | 값 | 의미 |
|:---|:---|:---|
| `BM25_K1` | 1.2 | TF 포화 곡선의 기울기 제어. 높을수록 빈도가 높은 문서 우대 |
| `BM25_B` | 0.75 | 문서 길이 보정 비율. 1.0이면 완전 정규화, 0이면 길이 무시 |

### 5.3 IDF (Inverse Document Frequency)

```
IDF(t) = ln( (N - df(t) + 0.5) / (df(t) + 0.5) + 1 )
```

```typescript
// hybrid-search.ts:75
const idf = Math.log((corpusSize - df + 0.5) / (df + 0.5) + 1);
```

- `N` = `corpusSize` (전체 문서 수)
- `df(t)` = 용어 `t`를 포함하는 문서 수

**해석**: 
- 모든 문서에 나타나는 흔한 단어 → IDF ≈ 0 (정보량 낮음)
- 소수 문서에만 나타나는 단어 → IDF 높음 (변별력 높음)
- `+ 1`은 IDF가 음수가 되는 것을 방지 (표준 BM25 개선)

### 5.4 TF 정규화

```
tfNorm(t, d) = tf(t,d) × (k1 + 1)
               ──────────────────────────────────────
               tf(t,d) + k1 × (1 - b + b × |d|/avgdl)
```

```typescript
// hybrid-search.ts:81-82
const tfNorm = (tf * (BM25_K1 + 1)) /
    (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgLen)));
```

- `tf(t,d)` = 문서 `d`에서 용어 `t`의 출현 횟수
- `|d|` = `docLen` (문서의 문자 수)
- `avgdl` = `avgLen` (코퍼스 평균 문서 길이)

**특성**:
- `tf`가 증가할수록 `tfNorm`은 점근적으로 `(k1+1)` = 2.2에 수렴 (포화)
- 문서가 평균보다 길면 분모가 커져 점수가 낮아짐 (길이 페널티)
- 문서가 평균보다 짧으면 분모가 작아져 점수가 높아짐 (길이 보상)

### 5.5 최종 점수

```
score(d) = Σ IDF(t) × tfNorm(t, d)    (t ∈ query terms)
```

```typescript
// hybrid-search.ts:84
scores.set(name, prev + idf * tfNorm);
```

### 5.6 용어 빈도 계산

`countOccurrences()` ([hybrid-search.ts:198–206](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L198-L206))는 **비중첩(non-overlapping)** 방식으로 텍스트 내 용어 출현 횟수를 센다:

```typescript
private countOccurrences(text: string, term: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(term, pos)) !== -1) {
        count++;
        pos += term.length;  // 겹치지 않게 다음 위치로 이동
    }
    return count;
}
```

### 5.7 문서 빈도 계산

`documentFrequency()` ([hybrid-search.ts:218–224](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L218-L224))는 용어를 포함하는 문서 수를 선형 스캔으로 계산한다:

```typescript
private documentFrequency(term: string): number {
    let count = 0;
    for (const content of this.contentMap.values()) {
        if (content.includes(term)) count++;
    }
    return count;
}
```

> **설계 트레이드오프**: 역색인을 별도로 구축하지 않고 매 쿼리마다 전체 코퍼스를 스캔한다. 문서 수가 수백 수준인 프로젝트 내 지식 저장소에서는 충분히 빠르지만, 수만 건 이상으로 확장하면 역색인이 필요할 것이다.

---

## 6. 태그 검색

`tagSearch()` ([hybrid-search.ts:94–105](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L94-L105))는 쿼리 용어를 태그로 취급하여 매칭되는 노트를 찾는다.

### 6.1 알고리즘

```
각 쿼리 용어(term)에 대해:
  tagIndexer.getFilesWithTag(term) → 파일 집합
  각 파일에 대해:
    noteName = graphParser.getNoteName(file)
    scores[noteName] += 1
```

```typescript
private tagSearch(terms: string[]): string[] {
    const scores = new Map<string, number>();
    for (const term of terms) {
        const files = this.tagIndexer.getFilesWithTag(term);
        for (const file of files) {
            const noteName = this.graphParser.getNoteName(file);
            const prev = scores.get(noteName) ?? 0;
            scores.set(noteName, prev + 1);
        }
    }
    return this.sortByScore(scores);
}
```

### 6.2 점수 체계

- **점수 = 매칭된 쿼리 용어(태그) 수**
- 쿼리가 `"architecture search"`이고 어떤 노트가 두 태그 모두 가지고 있으면 → 점수 2
- 하나만 매칭되면 → 점수 1

### 6.3 설계 근거

태그 검색은 **구조적 메타데이터**를 활용한다. 본문에 키워드가 없더라도 적절한 태그가 붙어 있으면 검색에 걸릴 수 있다. 이는 BM25의 어휘적 한계를 보완하는 역할을 한다.

---

## 7. 그래프 검색 — 2-hop BFS

### 7.1 개요

`graphSearch()` ([hybrid-search.ts:110–119](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L110-L119))는 태그 검색 결과를 **시드 노트**로 삼아 링크 그래프를 2-hop까지 탐색하여 관련 노트를 발견한다.

```
쿼리 → tagSearch() → 시드 노트들
                       │
                       ▼
               ┌───────────────┐
               │ traverseGraph │
               │  depth=2      │
               └───────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   1-hop 이웃      2-hop 이웃     (depth=0 중단)
   score += 2     score += 1
```

### 7.2 탐색 상수

```typescript
// hybrid-search.ts:26
const GRAPH_HOP_DEPTH = 2;
```

### 7.3 traverseGraph 알고리즘

([hybrid-search.ts:124–143](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L124-L143))

```typescript
private traverseGraph(
    note: string,
    depth: number,
    visited: Set<string>,
    scores: Map<string, number>,
): void {
    if (depth <= 0 || visited.has(note)) return;
    visited.add(note);

    const neighbors = [
        ...this.graphParser.getForwardLinks(note),
        ...this.graphParser.getBacklinks(note),
    ];

    for (const neighbor of neighbors) {
        const prev = scores.get(neighbor) ?? 0;
        scores.set(neighbor, prev + depth);     // ← 가까울수록 높은 점수
        this.traverseGraph(neighbor, depth - 1, visited, scores);
    }
}
```

**핵심 동작:**

1. **양방향 탐색**: forward link와 backlink를 **모두** 이웃으로 취급
2. **점수 = 잔여 깊이**: 1-hop 이웃 → `+2`, 2-hop 이웃 → `+1`
3. **방문 추적**: `visited` Set으로 순환 방지
4. **깊이 제한**: `GRAPH_HOP_DEPTH = 2`이므로 최대 2-hop까지만 탐색

### 7.4 점수 누적

하나의 노트가 여러 시드에서 도달 가능하면 점수가 누적된다:

```
시드 A → 노트 X (1-hop, +2)
시드 B → 노트 X (1-hop, +2)
────────────────────────────
노트 X 최종 점수 = 4
```

### 7.5 설계 근거

- **2-hop 제한**: 소규모 지식 그래프에서 3-hop 이상은 거의 모든 노트에 도달하여 변별력이 사라짐
- **깊이 기반 점수**: 시드에 가까울수록 관련성이 높다는 직관 반영
- **태그 시드 의존**: 그래프 검색 단독이 아닌 태그 검색 결과에서 시작하므로, 관련 없는 그래프 영역으로의 확산을 억제

---

## 8. RRF 하이브리드 합의

### 8.1 Reciprocal Rank Fusion (RRF)

`fuseResults()` ([hybrid-search.ts:149–166](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L149-L166))은 세 검색 엔진의 순위 목록을 **Reciprocal Rank Fusion**으로 통합한다.

### 8.2 공식

```
RRF_score(d) = Σ w_i × 1/(k + rank_i(d))
               i ∈ {lexical, tag, graph}
```

- `k` = `RRF_K = 60` (평활 상수, [원본 RRF 논문](https://dl.acm.org/doi/10.1145/1571941.1572114)의 표준값)
- `rank_i(d)` = 엔진 `i`에서 문서 `d`의 순위 (0-based)
- `w_i` = 엔진별 가중치 (`EngineWeights`에서 제공)

### 8.3 상수

```typescript
// hybrid-search.ts:18
const RRF_K = 60;
// hybrid-search.ts:20
const DEFAULT_MAX_RESULTS = 20;
```

### 8.4 구현 세부

`addRrfScores()` ([hybrid-search.ts:172–190](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L172-L190)):

```typescript
private addRrfScores(
    fused: Map<string, { score: number; matchType: SearchResult["matchType"] }>,
    ranked: string[],
    matchType: SearchResult["matchType"],
    weight: number = 1,
): void {
    for (let i = 0; i < ranked.length; i++) {
        const rrfScore = weight * (1 / (RRF_K + i + 1));
        const existing = fused.get(ranked[i]);
        if (existing) {
            existing.score += rrfScore;
            if (rrfScore > 1 / (RRF_K + 1)) {
                existing.matchType = matchType;
            }
        } else {
            fused.set(ranked[i], { score: rrfScore, matchType });
        }
    }
}
```

**matchType 결정 로직:**

```
rrfScore > 1/(RRF_K + 1)  →  이 엔진의 rank가 0 (1위)일 때의 점수보다 높은가?

사실상 rank=0일 때:  weight × 1/(60+0+1) = weight × 1/61
비교 기준:           1/(60+1) = 1/61

따라서 weight > 1인 엔진이 1위 결과를 제공하면 matchType이 갱신됨
```

이는 **가장 큰 기여를 한 엔진**이 해당 결과의 `matchType`을 결정하도록 보장한다.

### 8.5 RRF의 장점

```
          점수  
  0.016 ┤ ■ rank 0
  0.015 ┤ ■ rank 1
  0.014 ┤ ■ rank 2
  0.013 ┤ ■ rank 3
        │   ...       ← 순위가 내려가면 점수 차이가 급격히 줄어듦
  0.003 ┤             ■ rank 100
        └──────────────────────────
```

- 각 엔진의 **원시 점수 스케일에 무관**하게 순위만으로 통합
- BM25의 점수 범위(0~수십)와 태그 점수(정수 카운트)를 직접 비교하는 문제 회피
- `k=60`은 상위 순위에 대한 민감도를 적절히 조절 (너무 작으면 1위만 중요, 너무 크면 순위 차이 무시)

---

## 9. 역할별 검색 가중치

### 9.1 EngineWeights 인터페이스

([retrieval-weights.ts:16–20](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L16-L20))

```typescript
export interface EngineWeights {
    lexical: number;   // BM25 가중치
    tag: number;       // 태그 검색 가중치
    graph: number;     // 그래프 검색 가중치
}
```

### 9.2 ROLE_WEIGHTS 테이블

([retrieval-weights.ts:28–37](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L28-L37))

| 역할 | lexical | tag | graph | 설계 근거 |
|:---|:---:|:---:|:---:|:---|
| **planner** | 0.8 | 1.1 | **1.3** | 의존성/아키텍처를 추론 → 그래프 구조 우선 |
| **worker** | **1.3** | 1.0 | 0.7 | 구체적 구현 → 정확한 키워드 히트 우선 |
| **reviewer** | 1.0 | **1.2** | 1.0 | 증거의 폭 필요 → 태그/주제 커버리지 우선 |
| **commander** | 1.0 | 1.0 | 1.0 | 조율 역할 → 중립 |

시각적으로 표현하면:

```
             lexical    tag    graph
  planner:    ████░      █████░     ███████░   ← 그래프 강조
  worker:     ███████░   █████░     ████░      ← 키워드 강조
  reviewer:   █████░     ██████░    █████░     ← 태그 강조
  commander:  █████░     █████░     █████░     ← 균등
```

### 9.3 weightsForRole()

([retrieval-weights.ts:39–42](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L39-L42))

```typescript
export function weightsForRole(role?: string | null): EngineWeights {
    if (!role) return NEUTRAL_WEIGHTS;
    return ROLE_WEIGHTS[role.toLowerCase()] ?? NEUTRAL_WEIGHTS;
}
```

- 역할이 `null`/`undefined`이면 중립 가중치 `{ 1, 1, 1 }` 반환
- 대소문자 무관 매칭
- 알 수 없는 역할도 중립으로 폴백

### 9.4 가중치의 효과

RRF 공식에서 가중치는 **곱셈 인자**로 적용된다:

```
가중치가 1.3인 엔진의 1위 기여:  1.3 × 1/(60+1) ≈ 0.0213
가중치가 0.7인 엔진의 1위 기여:  0.7 × 1/(60+1) ≈ 0.0115
```

→ 약 **1.86배** 차이. 동일 순위에서 선호 엔진의 기여가 거의 2배 커진다.

---

## 10. 메모리 수평선 (Memory Horizon)

### 10.1 MemoryHorizon 타입

([retrieval-weights.ts:45](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L45))

```typescript
export type MemoryHorizon = "strategic" | "execution" | "closure";
```

| 수평선 | 의미 | 메모리 수명 |
|:---|:---|:---|
| `strategic` | 프로젝트 전반에 걸쳐 유효 | 장기 (세션 간 유지) |
| `execution` | 현재 미션 실행 중 유효 | 중기 (미션 종료 시 만료 가능) |
| `closure` | 특정 태스크 완료 시까지 유효 | 단기 (태스크 종료 시 만료) |

### 10.2 horizonForLevel()

([retrieval-weights.ts:47–58](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L47-L58))

```typescript
export function horizonForLevel(level: string): MemoryHorizon {
    switch (level) {
        case "system":
        case "project":
            return "strategic";
        case "task":
            return "closure";
        case "mission":
        default:
            return "execution";
    }
}
```

**매핑 관계:**

```
MemoryLevel          MemoryHorizon
─────────────        ─────────────
system      ───────→ strategic       (장기, 시스템 전반)
project     ───────→ strategic       (장기, 프로젝트 전반)
mission     ───────→ execution       (중기, 미션 단위)
task        ───────→ closure         (단기, 태스크 단위)
(unknown)   ───────→ execution       (기본값)
```

### 10.3 미션 메모리 노트에서의 활용

`mission-memory.ts`의 `buildMemoryNoteContent()` ([mission-memory.ts:219–247](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/mission-memory.ts#L219-L247))에서 각 메모리 노트의 frontmatter에 수평선을 기록한다:

```yaml
---
tags: [mission-memory, orchestrator, project]
title: "project memory abc-123"
keep: true
level: "project"
horizon: "strategic"         ← horizonForLevel("project")
importance: 0.850
session: "sess-001"
recorded_at: "2026-06-19T10:30:00Z"
objective: "검색 시스템 구현"
---
```

이를 통해 메모리 정리(consolidation) 시 수평선에 따라 만료 정책을 적용할 수 있다.

---

## 11. 신경망 임베딩과의 비교

현재 opencode-orchestrator의 검색 시스템은 **순수 통계/구조 기반**이다. 신경망 임베딩을 사용하지 않는다.

### 11.1 현재 시스템에 없는 것

| 구성 요소 | 현재 상태 | 설명 |
|:---|:---:|:---|
| Dense Retrieval (밀집 검색) | ❌ 없음 | 사전 훈련된 인코더(BERT, E5 등)로 문서를 벡터화하여 의미적 유사도 검색 |
| Cross-Encoder 재순위 | ❌ 없음 | 쿼리-문서 쌍을 동시에 인코딩하여 정밀 재순위 |
| 벡터 DB / ANN 인덱스 | ❌ 없음 | FAISS, Qdrant 등의 근사 최근접 이웃 검색 |
| 학습된 Sparse 표현 | ❌ 없음 | SPLADE 등의 학습된 희소 벡터 |

### 11.2 비교 테이블

| 차원 | 현재 시스템 (BM25 + Tag + Graph) | Dense Retrieval + Cross-Encoder |
|:---|:---|:---|
| **의미 이해** | ❌ 어휘 매칭만 가능. "검색" ≠ "탐색" | ✅ 동의어·패러프레이즈 이해 |
| **다국어 교차 검색** | ❌ 동일 언어 토큰만 매칭 | ✅ 다국어 모델로 교차 가능 |
| **인프라 요구** | ✅ 제로 의존성, Node.js만 필요 | ❌ GPU/모델 서빙, 벡터 DB 필요 |
| **레이턴시** | ✅ 밀리초 단위 | ⚠️ 수십~수백 ms (모델 추론) |
| **투명성** | ✅ 점수 공식이 명시적 | ⚠️ 블랙박스 (해석 어려움) |
| **업데이트 비용** | ✅ 즉시 재인덱싱 | ⚠️ 벡터 재계산 필요 |
| **구조적 관계 활용** | ✅ 위키링크 그래프 탐색 | ❌ 문서 간 링크 무시 (별도 구현 필요) |
| **메타데이터 활용** | ✅ frontmatter 태그 | ⚠️ 메타데이터 필터링 별도 구현 필요 |
| **콜드 스타트** | ✅ 문서만 있으면 동작 | ❌ 모델 다운로드/파인튜닝 필요 |

### 11.3 현재 설계의 강점

1. **제로 의존성**: 외부 모델·벡터 DB 없이 `node:fs`만으로 동작
2. **결정론적 재현**: 동일 입력 → 동일 출력, 디버깅 용이
3. **구조 인식**: 위키링크 그래프를 통해 문서 간 **관계**를 검색에 반영
4. **역할 적응**: 에이전트 역할에 따라 검색 전략을 자동 조정
5. **즉시 갱신**: 파일 변경 시 재인덱싱이 즉각적, 벡터 재계산 불필요

---

## 12. 한계와 향후 고도화 방향

### 12.1 현재 한계

| # | 한계 | 영향 | 심각도 |
|:---|:---|:---|:---:|
| 1 | **의미적 매칭 불가** | "검색 엔진" 쿼리로 "탐색 시스템" 문서를 찾을 수 없음 | 높음 |
| 2 | **다국어 교차 검색 불가** | 한국어 쿼리로 영어 문서를 찾을 수 없음 | 중간 |
| 3 | **DF 계산의 선형 스캔** | 매 쿼리마다 전체 코퍼스 스캔 (`O(N×T)`, N=문서 수, T=용어 수) | 낮음¹ |
| 4 | **그래프 시드가 태그에 의존** | 태그가 없는 문서는 그래프 검색의 시드가 될 수 없음 | 중간 |
| 5 | **단일 토크나이저** | 공백 분리만 사용, 형태소 분석·서브워드 토크나이징 없음 | 중간 |
| 6 | **스니펫의 단순 절삭** | 쿼리 관련 부분이 아닌 문서 첫 220자를 반환 | 낮음 |

> ¹ 프로젝트 내 지식 저장소는 보통 수백 건 이하이므로 현재 규모에서는 문제없음

### 12.2 고도화 로드맵

```
                현재 (v1)                    향후 (v2)
         ┌──────────────────┐        ┌──────────────────────┐
         │  BM25 + Tag +    │        │  BM25 + Tag + Graph  │
         │  Graph + RRF     │   →    │  + Dense + RRF       │
         │                  │        │  + Cross-Encoder     │
         │  (어휘 매칭만)    │        │  (의미 + 어휘)        │
         └──────────────────┘        └──────────────────────┘
```

**단계별 고도화 방안:**

| 단계 | 추가 구성 요소 | 기대 효과 | 난이도 |
|:---|:---|:---|:---:|
| **v1.1** | 용어 역색인 (`Map<term, Set<doc>>`) | DF 계산 O(1)화 | 낮음 |
| **v1.2** | 쿼리 하이라이팅 스니펫 | 검색 결과의 맥락 이해 향상 | 낮음 |
| **v1.3** | 형태소 분석기 연동 (한국어 `nori`, 영어 `stemmer`) | 어형 변화에 대한 매칭력 향상 | 중간 |
| **v2.0** | Dense Retrieval (경량 임베딩 모델, 예: `gte-small`) | 동의어·패러프레이즈 매칭 | 높음 |
| **v2.1** | 다국어 모델 (`multilingual-e5-small`) | 한국어 ↔ 영어 교차 검색 | 높음 |
| **v2.2** | Cross-Encoder 재순위 | 상위 N개 결과의 정밀도 향상 | 높음 |
| **v2.3** | 레이블 가중 RRF | 검색 품질 피드백으로 엔진 가중치 학습 | 높음 |

### 12.3 Dense Retrieval 통합 시 아키텍처 제안

```
                       ┌───────────────────────┐
                       │    search(query)       │
                       └───────────┬───────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
  │ lexicalSearch│        │  tagSearch   │        │ graphSearch  │
  │   (BM25)     │        │              │        │  (2-hop BFS) │
  └──────┬───────┘        └──────┬───────┘        └──────┬───────┘
         │                       │                       │
         │  ┌──────────────┐     │                       │
         │  │ denseSearch  │ ◄───┤  (NEW: 4번째 엔진)    │
         │  │ (벡터 유사도)  │     │                       │
         │  └──────┬───────┘     │                       │
         │         │             │                       │
         └─────────┼─────────────┼───────────────────────┘
                   ▼
          ┌──────────────────┐
          │   fuseResults    │
          │  RRF (k=60)     │
          │  × EngineWeights │  ← EngineWeights에 `dense` 필드 추가
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │ Cross-Encoder    │  (선택적 재순위)
          │ 상위 10개만 정밀  │
          │  점수 재계산      │
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │  SearchResult[]  │
          └──────────────────┘
```

**핵심 설계 원칙**: 기존 RRF 파이프라인을 보존하면서 Dense 엔진을 **4번째 순위 목록**으로 추가. `EngineWeights`에 `dense` 필드만 추가하면 기존 역할별 가중치 시스템과 자연스럽게 통합된다.

---

## 부록: 보조 모듈

### A. MemoryConsolidation

([memory-consolidation.ts](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/memory-consolidation.ts))

그래프 **유지보수**를 위한 순수 분석 함수들 (부수 효과 없음):

| 메서드 | 기능 |
|:---|:---|
| `identifyOversizedNotes(contentMap, maxLines?)` | 500줄(기본값) 초과 노트 탐지 → 분할 후보 |
| `identifyOrphanNotes(allNotes)` | forward link·backlink 모두 0인 고아 노트 탐지 |
| `suggestMerges(threshold?)` | 공유 태그 3개(기본값) 이상인 노트 쌍 → 병합 후보 |
| `generateMOC(tag)` | 특정 태그의 Map of Content 마크다운 생성 |

### B. SafetyGuards

([safety-guards.ts](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/safety-guards.ts))

| 기능 | 메서드 | 설명 |
|:---|:---|:---|
| 순환 링크 감지 | `checkCircularLinks(graph, startNote, maxDepth?)` | depth-limited DFS로 자기 자신으로의 순환 탐지 |
| 동시 쓰기 보호 | `createWriteQueue()` | FIFO 비동기 큐로 파일 쓰기 직렬화 |
| 고정 노트 확인 | `isPinned(metadata)` | `keep: true` frontmatter → 정리 대상 제외 |

### C. Scratchpad

([scratchpad.ts](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/scratchpad.ts))

| 특성 | 값 |
|:---|:---|
| 최대 엔트리 | 64 |
| 엔트리당 최대 크기 | 4,096 bytes |
| 퇴거 정책 | LRU (Map 삽입 순서 활용) |
| 직렬화 형식 | 마크다운 (`# Scratchpad Registers` + `## key` 블록) |

---

> **이 문서는 `src/core/knowledge/` 디렉터리의 소스 코드를 기반으로 작성되었습니다.**
> **소스 코드와 이 문서의 내용이 불일치할 경우, 항상 소스 코드를 신뢰하십시오.**
