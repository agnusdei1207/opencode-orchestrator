# 로컬 퍼스트 검색 고도화 제안서

> **opencode-orchestrator** 하이브리드 검색 시스템 차세대 진화 로드맵

---

## 메타데이터

| 항목 | 값 |
|:-----|:---|
| **작성일** | 2026-06-19 |
| **대상 프로젝트** | opencode-orchestrator (TypeScript / Node.js) |
| **현행 시스템** | BM25 렉시컬 + 태그 검색 + 위키링크 그래프 2-hop BFS + RRF 융합 + 역할별 가중치 |
| **제약 조건** | GPU 없음 · 외부 모델 파일 없음 · 외부 API 없음 · CPU 전용 · 브라우저 호환 고려 |
| **핵심 파일** | `hybrid-search.ts` · `retrieval-weights.ts` · `tag-indexer.ts` · `graph-parser.ts` · `context-provider.ts` |

---

## 현행 시스템 분석

### 아키텍처 개관

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    KnowledgeContextProvider                             │
│  context-provider.ts:20  ─ buildPrompt() 오케스트레이션                  │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐                         │
│  │TagIndexer│    │GraphParser│    │HybridSearch│                         │
│  │tag-index │    │graph-pars│    │hybrid-sear │                         │
│  │er.ts:16  │    │er.ts:5   │    │ch.ts:28    │                         │
│  └────┬─────┘    └─────┬────┘    └──────┬─────┘                         │
│       │                │               │                                │
│       ▼                ▼               ▼                                │
│   frontmatter      wikilink        BM25 lexical                        │
│   tag 파싱         양방향 그래프     TF-IDF 스코어링                      │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │         RRF Fusion  (K=60)  ×  역할별 가중치                  │       │
│  │         hybrid-search.ts:149  fuseResults()                   │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                              ▼                                          │
│                    SearchResult[] (Top-N)                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 핵심 구성요소 상세

#### 1. BM25 렉시컬 검색 — `hybrid-search.ts:66-89`

```typescript
// hybrid-search.ts:72-86
private lexicalSearch(terms: string[]): string[] {
    const scores = new Map<string, number>();
    const avgLen = this.computeAverageLength();        // L78: 문자 기반 평균 길이

    for (const term of terms) {
        const df = this.documentFrequency(term);       // L74: 전수 스캔 O(N)
        const idf = Math.log((corpusSize - df + 0.5) / (df + 0.5) + 1);  // L75

        for (const [name, content] of this.contentMap) {
            const tf = this.countOccurrences(content, term);  // L78: indexOf 루프
            // BM25 정규화  K1=1.2, B=0.75
            const tfNorm = (tf * (BM25_K1 + 1)) /
                (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgLen)));
        }
    }
}
```

**현재 한계:**
- `countOccurrences()` (L198-206)는 단순 `indexOf` 루프 → **위치 정보 버림**
- 질의어 `["error", "handling"]`이 같은 문장에 나타나는지, 1000행 간격인지 구분 불가
- `documentFrequency()` (L218-224)가 **매 질의마다 전수 스캔** → O(terms × docs)

#### 2. 태그 검색 — `tag-indexer.ts:16-207`

```typescript
// tag-indexer.ts:82-95
public indexFile(filePath: string, fileContent: string): void {
    const { data } = this.parseFrontmatter(fileContent);
    // YAML frontmatter에서 tags 배열만 추출
    if (data.tags && Array.isArray(data.tags)) {
        for (const tag of data.tags) {
            this.addTagEntry(tag.toLowerCase(), filePath);
        }
    }
}
```

- O(1) 태그 조회 (`tagMap: Map<string, Set<string>>`, L17)
- 프론트매터 전용 — **본문 해시태그(`#topic`)는 무시됨**

#### 3. 그래프 검색 — `graph-parser.ts:5-152` + `hybrid-search.ts:110-143`

```typescript
// hybrid-search.ts:124-143
private traverseGraph(note, depth, visited, scores): void {
    if (depth <= 0 || visited.has(note)) return;
    visited.add(note);
    const neighbors = [
        ...this.graphParser.getForwardLinks(note),   // L134
        ...this.graphParser.getBacklinks(note),       // L135
    ];
    for (const neighbor of neighbors) {
        scores.set(neighbor, prev + depth);           // L140: depth 기반 점수만
        this.traverseGraph(neighbor, depth - 1, ...); // L141: 재귀 2-hop
    }
}
```

**현재 한계:**
- 모든 이웃이 depth 값으로 동일한 점수 → **허브 노트 vs 말단 노트 구분 불가**
- 그래프 구조적 중요도(링크 수, 연결 중심성)를 전혀 반영하지 않음

#### 4. RRF 융합 + 역할별 가중치 — `hybrid-search.ts:149-190` + `retrieval-weights.ts:16-42`

```typescript
// retrieval-weights.ts:28-37
export const ROLE_WEIGHTS: Record<string, EngineWeights> = {
    planner:   { lexical: 0.8, tag: 1.1, graph: 1.3 },  // L30: 구조 선호
    worker:    { lexical: 1.3, tag: 1.0, graph: 0.7 },  // L32: 정확 매칭 선호
    reviewer:  { lexical: 1.0, tag: 1.2, graph: 1.0 },  // L34: 태그 커버리지 선호
    commander: { lexical: 1,   tag: 1,   graph: 1   },  // L36: 중립
};
```

- **3-way RRF**: `score(d) = Σ weight_i / (60 + rank_i + 1)` (L179)
- 가중치가 **하드코딩** → 사용자 피드백 반영 불가
- **시맨틱 채널 자체가 없음** → 동의어/의미적 유사 문서 검색 불가

#### 5. 오케스트레이션 — `context-provider.ts:20-129`

```typescript
// context-provider.ts:65-90
private indexKnowledge(directory, files): IndexedKnowledge {
    const tagIndexer = new TagIndexer();
    const graphParser = new GraphParser();
    const search = new HybridSearch(tagIndexer, graphParser);
    // ... 파일별 인덱싱 루프
    tagIndexer.indexFile(filePath, content);     // L79
    graphParser.indexFile(filePath, content);    // L80
    search.indexContent(noteName, normalizedBody); // L81
}
```

- **매 질의마다 전체 재인덱싱** (L65-90) — 캐시/증분 인덱싱 없음
- `MAX_RESULTS = 3` (L8), `MAX_SNIPPET_CHARS = 220` (L9)으로 고정

---

## 현행 시스템 약점 요약

```
┌──────────────────────────────────────────────────────────┐
│                    현재 검색 파이프라인 약점               │
├──────────────────┬───────────────────────────────────────┤
│ 약점             │ 영향                                   │
├──────────────────┼───────────────────────────────────────┤
│ 위치 정보 소실    │ "error handling" 구문 근접 무시         │
│ 시맨틱 채널 없음  │ 동의어·유사 개념 검색 불가              │
│ 허브 노트 미구분  │ 중요 노트와 말단 노트 동일 점수         │
│ 질의 확장 없음    │ 단어 그대로만 매칭                     │
│ 하드코딩 가중치   │ 사용 패턴 적응 불가                    │
│ 고정 RRF 공식    │ 최적 결합 학습 불가                    │
│ 매 질의 재인덱싱  │ 코퍼스 규모 증가 시 지연               │
└──────────────────┴───────────────────────────────────────┘
```

---

## 제안 1: PageRank 그래프 스코어링

### 현황

`graphSearch()` (hybrid-search.ts:110-119)는 시드 노트에서 2-hop BFS를 수행하며 `depth` 값만 점수로 사용한다:

```typescript
// hybrid-search.ts:139-140
const prev = scores.get(neighbor) ?? 0;
scores.set(neighbor, prev + depth);  // depth=2이면 2점, depth=1이면 1점
```

이 방식은 **모든 이웃을 동등하게** 취급한다. 10개 노트에서 링크되는 허브 노트와, 단 1개 노트에서만 참조되는 말단 노트가 동일한 가중치를 받는다.

### 제안 요약

`GraphParser`에 `pagerank()` 메서드를 추가하여, 그래프 전체의 **구조적 중요도**를 정량화한다. 이 PageRank 점수를 `traverseGraph()`의 depth 기반 점수에 가산하여, 허브 노트가 자연스럽게 상위로 부상하도록 만든다.

### 설계

```
┌────────────────────────────────────────────────────────────┐
│             PageRank 통합 파이프라인                        │
│                                                            │
│  indexFile() 호출 후                                       │
│       │                                                    │
│       ▼                                                    │
│  GraphParser.computePageRank()                             │
│       │  20회 반복 (damping=0.85)                          │
│       ▼                                                    │
│  Map<noteName, prScore>                                    │
│       │                                                    │
│       ▼                                                    │
│  traverseGraph() 점수 = depth + α × pagerank(neighbor)    │
│       │                                                    │
│       ▼                                                    │
│  RRF 융합 (기존 파이프라인)                                 │
└────────────────────────────────────────────────────────────┘
```

### Before / After

**Before** (`hybrid-search.ts:138-142`):
```typescript
for (const neighbor of neighbors) {
    const prev = scores.get(neighbor) ?? 0;
    scores.set(neighbor, prev + depth);
    this.traverseGraph(neighbor, depth - 1, visited, scores);
}
```

**After**:
```typescript
for (const neighbor of neighbors) {
    const prev = scores.get(neighbor) ?? 0;
    const prBonus = this.graphParser.getPageRankScore(neighbor);
    scores.set(neighbor, prev + depth + PR_ALPHA * prBonus);
    this.traverseGraph(neighbor, depth - 1, visited, scores);
}
```

### 구현 스케치 — `graph-parser.ts`에 추가

```typescript
// graph-parser.ts — 새 메서드

private pageRankScores: Map<string, number> = new Map();

/**
 * Power-iteration PageRank. CPU-only, 의존성 없음.
 * O(iterations × edges) — 일반적 knowledge base에서 수십 ms.
 */
public computePageRank(
    damping: number = 0.85,
    iterations: number = 20,
): Map<string, number> {
    const allNotes = new Set<string>([
        ...this.forwardLinks.keys(),
        ...this.backlinks.keys(),
    ]);
    const N = allNotes.length || 1;
    const pr = new Map<string, number>();

    // 초기값: 균등 분배
    for (const note of allNotes) {
        pr.set(note, 1 / N);
    }

    // 반복 수렴
    for (let iter = 0; iter < iterations; iter++) {
        const next = new Map<string, number>();
        for (const note of allNotes) {
            next.set(note, (1 - damping) / N);
        }
        for (const [source, targets] of this.forwardLinks) {
            const share = (pr.get(source) ?? 0) / (targets.size || 1);
            for (const target of targets) {
                next.set(target, (next.get(target) ?? 0) + damping * share);
            }
        }
        for (const [note, score] of next) {
            pr.set(note, score);
        }
    }

    this.pageRankScores = pr;
    return pr;
}

public getPageRankScore(note: string): number {
    return this.pageRankScores.get(note) ?? 0;
}
```

### 성능 영향

| 항목 | 값 |
|:-----|:---|
| **시간 복잡도** | O(iterations × edges) ≈ O(20 × E) |
| **예상 지연** | 1,000 노트 / 5,000 엣지 기준 < 10ms |
| **메모리** | Map 1개 추가 (노트 수 × 8 bytes) |
| **인덱싱 시점** | `indexKnowledge()` 완료 후 1회 호출 |

### 리스크 평가

| 리스크 | 심각도 | 완화 전략 |
|:-------|:------:|:---------|
| Dangling 노트 (outlink 0) → sink 문제 | 낮음 | `(1-d)/N` 텔레포트 항이 자동 보정 |
| 그래프 변경 시 재계산 비용 | 낮음 | 현재도 매 질의마다 재인덱싱하므로 추가 비용 미미 |
| PR 점수 범위가 depth 점수와 스케일 불일치 | 중간 | `PR_ALPHA` 계수로 조절 (기본 10.0 권장) |

### 구현 난이도: `낮음` 🟢
### 의존성 추가: **없음**

---

## 제안 2: 위치 인덱스 + 구문 근접 보너스 (Proximity Scoring)

### 현황

`countOccurrences()` (hybrid-search.ts:198-206)는 텀의 **출현 횟수만** 세고 **위치 정보를 버린다**:

```typescript
// hybrid-search.ts:198-206
private countOccurrences(text: string, term: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(term, pos)) !== -1) {
        count++;
        pos += term.length;
    }
    return count;
}
```

질의 `"error handling"`에 대해:
- 문서 A: "error" ... (500자 후) ... "handling" → 2점
- 문서 B: "error handling strategy" → 2점
- **두 문서의 점수가 동일** — 명백한 정보 손실

### 제안 요약

`countOccurrences()`를 **위치 목록을 반환하는 `getTermPositions()`로 교체**하고, 질의어 쌍의 **최소 거리(span)**에 기반한 근접 보너스를 BM25 점수에 가산한다.

### 설계

```
┌───────────────────────────────────────────────────────────┐
│              Proximity Scoring 파이프라인                   │
│                                                           │
│  terms = ["error", "handling"]                            │
│                                                           │
│  문서별:                                                  │
│  1. getTermPositions("error")   → [12, 450, 890]         │
│  2. getTermPositions("handling") → [20, 900]              │
│  3. minSpan = min(|12-20|, |450-20|, ...) = 8            │
│  4. proximityBonus = 1 / (1 + minSpan/WINDOW)            │
│  5. finalScore = bm25Score + PROX_WEIGHT × proximityBonus │
└───────────────────────────────────────────────────────────┘
```

### Before / After

**Before** (`hybrid-search.ts:78`):
```typescript
const tf = this.countOccurrences(content, term);
```

**After**:
```typescript
const positions = this.getTermPositions(content, term);
const tf = positions.length;
// ... BM25 계산 후 ...
const proximityBonus = this.computeProximityBonus(allPositions);
scores.set(name, prev + idf * tfNorm + PROX_WEIGHT * proximityBonus);
```

### 구현 스케치

```typescript
// hybrid-search.ts — 새 메서드들

/** 근접도 보너스 가중치 */
const PROX_WEIGHT = 0.5;
/** 근접 판정 윈도우 (문자 수) */
const PROX_WINDOW = 50;

/**
 * 텀의 모든 출현 위치를 반환한다.
 * countOccurrences()를 대체.
 */
private getTermPositions(text: string, term: string): number[] {
    const positions: number[] = [];
    let pos = 0;
    while ((pos = text.indexOf(term, pos)) !== -1) {
        positions.push(pos);
        pos += term.length;
    }
    return positions;
}

/**
 * 질의 텀 쌍의 최소 거리를 기반으로 근접 보너스 산출.
 * 모든 텀 쌍의 minimum span이 PROX_WINDOW 이내이면 최대 보너스.
 */
private computeProximityBonus(
    positionsByTerm: Map<string, number[]>,
): number {
    const termList = Array.from(positionsByTerm.entries());
    if (termList.length < 2) return 0;

    let totalBonus = 0;
    let pairCount = 0;

    for (let i = 0; i < termList.length; i++) {
        for (let j = i + 1; j < termList.length; j++) {
            const posA = termList[i][1];
            const posB = termList[j][1];
            const minDist = this.minPairDistance(posA, posB);
            totalBonus += 1 / (1 + minDist / PROX_WINDOW);
            pairCount++;
        }
    }

    return pairCount > 0 ? totalBonus / pairCount : 0;
}

/**
 * 두 정렬된 위치 배열 간 최소 거리를 O(n+m) 투 포인터로 산출.
 */
private minPairDistance(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return Infinity;
    let i = 0, j = 0, min = Infinity;
    while (i < a.length && j < b.length) {
        const dist = Math.abs(a[i] - b[j]);
        if (dist < min) min = dist;
        if (a[i] < b[j]) i++;
        else j++;
    }
    return min;
}
```

### 수정 대상 코드 (lexicalSearch 변경)

```typescript
// hybrid-search.ts:66-89  변경 후
private lexicalSearch(terms: string[]): string[] {
    const scores = new Map<string, number>();
    const corpusSize = this.contentMap.size;
    if (corpusSize === 0) return [];
    const avgLen = this.computeAverageLength();

    for (const [name, content] of this.contentMap) {
        let bm25Score = 0;
        const allPositions = new Map<string, number[]>();

        for (const term of terms) {
            const positions = this.getTermPositions(content, term);
            if (positions.length === 0) continue;
            allPositions.set(term, positions);

            const tf = positions.length;
            const df = this.documentFrequency(term);
            const idf = Math.log((corpusSize - df + 0.5) / (df + 0.5) + 1);
            const docLen = content.length;
            const tfNorm = (tf * (BM25_K1 + 1)) /
                (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgLen)));
            bm25Score += idf * tfNorm;
        }

        if (bm25Score > 0) {
            const proxBonus = this.computeProximityBonus(allPositions);
            scores.set(name, bm25Score + PROX_WEIGHT * proxBonus);
        }
    }

    return this.sortByScore(scores);
}
```

### 성능 영향

| 항목 | 현재 | 변경 후 |
|:-----|:-----|:--------|
| `countOccurrences` 반환 | `number` | `number[]` (위치 배열) |
| 추가 메모리 | 없음 | 질의당 임시 위치 배열 (질의 완료 후 GC) |
| 추가 CPU | 없음 | 투 포인터 O(n+m) × 텀 쌍 수 |
| **예상 추가 지연** | — | < 1ms (1,000 문서 기준) |

### 리스크 평가

| 리스크 | 심각도 | 완화 전략 |
|:-------|:------:|:---------|
| 짧은 문서에서 근접 보너스 과도 | 낮음 | 문서 길이 대비 정규화 가능 |
| 단일 텀 질의 시 보너스 0 | 없음 | `termList.length < 2`이면 0 반환 (설계 의도) |

### 구현 난이도: `중간` 🟡
### 의존성 추가: **없음**

---

## 제안 3: 코퍼스 기반 질의 확장 (Co-occurrence Query Expansion)

### 현황

현재 `tokenize()` (hybrid-search.ts:193-195)는 질의를 공백으로 분리하고 **그대로** 검색한다:

```typescript
// hybrid-search.ts:193-195
private tokenize(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter(Boolean);
}
```

질의 `"refactoring"`으로 검색하면, `"리팩터링"`, `"restructuring"`, `"코드 개선"` 등 의미적으로 동일한 텀이 포함된 문서를 찾을 수 없다.

### 제안 요약

코퍼스 내 **동시 출현(co-occurrence) 통계**를 수집하여, 질의 텀과 높은 상관관계를 보이는 텀을 자동 추가한다. 외부 모델이나 임베딩 없이 **코퍼스 자체의 통계**만으로 질의 확장을 수행한다.

### 설계

```
┌─────────────────────────────────────────────────────────────┐
│             Co-occurrence Query Expansion                    │
│                                                             │
│  인덱싱 시점 (1회):                                         │
│  ┌─────────────────────────────────────────┐                │
│  │ 모든 문서의 텀 쌍에 대해                  │                │
│  │ cooccurrence[termA][termB] += 1          │                │
│  │ (같은 문서에 함께 출현하면 카운트)          │                │
│  └─────────────────────────────────────────┘                │
│                                                             │
│  질의 시점:                                                  │
│  query = ["error"]                                          │
│       │                                                     │
│       ▼                                                     │
│  co-occurrence("error") → {handling: 42, log: 38, ...}      │
│       │                                                     │
│       ▼                                                     │
│  PMI 필터: PMI(error, handling) > threshold?                │
│       │                                                     │
│       ▼                                                     │
│  expanded = ["error", "handling"]   (가중치 0.5)            │
│       │                                                     │
│       ▼                                                     │
│  lexicalSearch(expanded)                                    │
└─────────────────────────────────────────────────────────────┘
```

### PMI (Pointwise Mutual Information) 기반 필터링

단순 빈도가 아닌 **PMI**를 사용해 의미 있는 연관어만 선별한다:

```
PMI(x, y) = log₂( P(x,y) / (P(x) × P(y)) )

P(x,y) = 텀 x와 y가 같은 문서에 등장할 확률
P(x)   = 텀 x가 등장할 확률
```

PMI가 높으면 우연 이상으로 자주 동시 출현 → 의미적 연관성 높음.

### 구현 스케치

```typescript
// hybrid-search.ts — 새 필드 및 메서드

/** 동시 출현 행렬: term → Map<term, count> */
private cooccurrence: Map<string, Map<string, number>> = new Map();
/** 문서 빈도: term → df */
private dfCache: Map<string, number> = new Map();

/** 질의 확장 후보 최대 수 */
const MAX_EXPANSION_TERMS = 3;
/** PMI 하한 임계값 */
const PMI_THRESHOLD = 1.0;
/** 확장 텀 가중치 (원본 텀은 1.0) */
const EXPANSION_WEIGHT = 0.5;

/**
 * 인덱싱 완료 후 호출 — 동시 출현 행렬 구축.
 * 각 문서의 고유 텀 쌍을 카운트한다.
 */
public buildCooccurrenceMatrix(): void {
    this.cooccurrence.clear();
    this.dfCache.clear();

    for (const [, content] of this.contentMap) {
        const docTerms = [...new Set(content.split(/\s+/).filter(t => t.length > 2))];
        for (const term of docTerms) {
            this.dfCache.set(term, (this.dfCache.get(term) ?? 0) + 1);
        }
        // 텀 쌍 동시 출현 카운트 (상위 빈출 텀만 제한하여 O(T²) 억제)
        const limited = docTerms.slice(0, 200);
        for (let i = 0; i < limited.length; i++) {
            for (let j = i + 1; j < limited.length; j++) {
                this.incrementCooccurrence(limited[i], limited[j]);
                this.incrementCooccurrence(limited[j], limited[i]);
            }
        }
    }
}

private incrementCooccurrence(a: string, b: string): void {
    let inner = this.cooccurrence.get(a);
    if (!inner) { inner = new Map(); this.cooccurrence.set(a, inner); }
    inner.set(b, (inner.get(b) ?? 0) + 1);
}

/**
 * PMI 기반 질의 확장.
 * 원본 텀과 동시 출현 빈도가 높은 텀을 최대 MAX_EXPANSION_TERMS개 반환.
 */
public expandQuery(terms: string[]): Array<{ term: string; weight: number }> {
    const result = terms.map(t => ({ term: t, weight: 1.0 }));
    const N = this.contentMap.size;
    if (N === 0) return result;

    const candidates = new Map<string, number>();

    for (const term of terms) {
        const coMap = this.cooccurrence.get(term);
        if (!coMap) continue;
        const pX = (this.dfCache.get(term) ?? 0) / N;

        for (const [coTerm, coCount] of coMap) {
            if (terms.includes(coTerm)) continue;
            const pY = (this.dfCache.get(coTerm) ?? 0) / N;
            const pXY = coCount / N;
            const pmi = Math.log2(pXY / (pX * pY + 1e-10));
            if (pmi > PMI_THRESHOLD) {
                const prev = candidates.get(coTerm) ?? 0;
                candidates.set(coTerm, Math.max(prev, pmi));
            }
        }
    }

    const sorted = Array.from(candidates.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_EXPANSION_TERMS);

    for (const [term] of sorted) {
        result.push({ term, weight: EXPANSION_WEIGHT });
    }

    return result;
}
```

### 성능 영향

| 항목 | 값 |
|:-----|:---|
| 동시 출현 행렬 구축 | O(docs × T²) — T를 200으로 제한 |
| 질의 확장 | O(co-occurrence 엔트리 수) — 보통 수백 |
| 메모리 | 스파스 Map 구조 — 1,000 문서 기준 수 MB |

### 리스크 평가

| 리스크 | 심각도 | 완화 전략 |
|:-------|:------:|:---------|
| 확장 텀이 의미 발산 (topic drift) | 중간 | PMI 임계값 + 최대 3개 제한 |
| 작은 코퍼스에서 통계 불안정 | 중간 | 최소 df 필터 (df ≥ 3) |
| 행렬 메모리 사용량 | 낮음 | 문서당 텀 200개 제한 |

### 구현 난이도: `중간` 🟡
### 의존성 추가: **없음**

---

## 제안 4: 로컬 해시 임베딩 추가 (Dense 채널 신설)

### 현황

현행 `HybridSearch`는 3가지 엔진만 보유한다:

```typescript
// hybrid-search.ts:55-57
const lexicalRanked  = this.lexicalSearch(terms);   // 엔진 1: BM25
const tagRanked      = this.tagSearch(terms);       // 엔진 2: 태그
const graphRanked    = this.graphSearch(terms);      // 엔진 3: 그래프

// retrieval-weights.ts:16-20
export interface EngineWeights {
    lexical: number;
    tag: number;
    graph: number;
    // ❌ semantic 필드 없음
}
```

**시맨틱 검색 채널이 전혀 없다.** "dependency injection"으로 검색해도 "DI 패턴"이라 표현된 문서를 찾을 수 없다.

### 제안 요약

**SimHash / MinHash 기반 로컬 해시 임베딩**을 4번째 엔진으로 추가한다.
외부 모델 없이 **n-gram 해시만으로** 문서 간 유사도를 계산하는 방식이다.

### 설계

```
┌────────────────────────────────────────────────────────────────┐
│            Hash Embedding Dense Channel                        │
│                                                                │
│  인덱싱 시점:                                                   │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  문서     │───▶│ char 3-gram  │───▶│ SimHash      │          │
│  │  content  │    │ 추출         │    │ 64-bit 벡터  │          │
│  └──────────┘    └──────────────┘    └──────┬───────┘          │
│                                             │                  │
│                                             ▼                  │
│                                    embeddings: Map<name, u64>  │
│                                                                │
│  질의 시점:                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  query   │───▶│ char 3-gram  │───▶│ SimHash      │          │
│  │          │    │ 추출         │    │ 64-bit 벡터  │          │
│  └──────────┘    └──────────────┘    └──────┬───────┘          │
│                                             │                  │
│                                             ▼                  │
│                      hamming distance로 전체 문서와 비교         │
│                                             │                  │
│                                             ▼                  │
│                      유사도 순으로 정렬 → ranked list            │
└────────────────────────────────────────────────────────────────┘
```

### Before / After — `EngineWeights` 변경

**Before** (`retrieval-weights.ts:16-20`):
```typescript
export interface EngineWeights {
    lexical: number;
    tag: number;
    graph: number;
}
```

**After**:
```typescript
export interface EngineWeights {
    lexical: number;
    tag: number;
    graph: number;
    semantic: number;      // ← 새 필드
}
```

**Before** (`retrieval-weights.ts:28-37`):
```typescript
export const ROLE_WEIGHTS: Record<string, EngineWeights> = {
    planner:   { lexical: 0.8, tag: 1.1, graph: 1.3 },
    worker:    { lexical: 1.3, tag: 1.0, graph: 0.7 },
    reviewer:  { lexical: 1.0, tag: 1.2, graph: 1.0 },
    commander: { lexical: 1,   tag: 1,   graph: 1   },
};
```

**After**:
```typescript
export const ROLE_WEIGHTS: Record<string, EngineWeights> = {
    planner:   { lexical: 0.8, tag: 1.1, graph: 1.3, semantic: 1.2 },
    worker:    { lexical: 1.3, tag: 1.0, graph: 0.7, semantic: 0.8 },
    reviewer:  { lexical: 1.0, tag: 1.2, graph: 1.0, semantic: 1.1 },
    commander: { lexical: 1,   tag: 1,   graph: 1,   semantic: 1   },
};
```

### Before / After — `fuseResults()` 4-way 변경

**Before** (`hybrid-search.ts:149-160`):
```typescript
private fuseResults(lexical, tags, graph, limit, weights): SearchResult[] {
    // ...
    this.addRrfScores(fused, lexical, "lexical", weights.lexical);
    this.addRrfScores(fused, tags,    "tag",     weights.tag);
    this.addRrfScores(fused, graph,   "graph",   weights.graph);
}
```

**After**:
```typescript
private fuseResults(lexical, tags, graph, semantic, limit, weights): SearchResult[] {
    // ...
    this.addRrfScores(fused, lexical,  "lexical",  weights.lexical);
    this.addRrfScores(fused, tags,     "tag",      weights.tag);
    this.addRrfScores(fused, graph,    "graph",    weights.graph);
    this.addRrfScores(fused, semantic, "semantic", weights.semantic);
}
```

### 구현 스케치 — `local-embedding.ts` (신규 파일)

```typescript
/**
 * LocalEmbedding - SimHash 기반 로컬 해시 임베딩.
 * 외부 모델/API 불필요. CPU-only, 브라우저 호환 가능.
 */
export class LocalEmbedding {
    private embeddings: Map<string, bigint> = new Map();

    /** char n-gram 추출 */
    private charNgrams(text: string, n: number = 3): string[] {
        const grams: string[] = [];
        const lower = text.toLowerCase().replace(/\s+/g, " ");
        for (let i = 0; i <= lower.length - n; i++) {
            grams.push(lower.slice(i, i + n));
        }
        return grams;
    }

    /**
     * SimHash: 64-bit 지문 생성.
     * 각 n-gram을 해시하고, 비트별로 가중 투표.
     */
    public simhash(text: string): bigint {
        const grams = this.charNgrams(text);
        const bits = new Int32Array(64);

        for (const gram of grams) {
            const h = this.fnv1a64(gram);
            for (let i = 0; i < 64; i++) {
                if ((h >> BigInt(i)) & 1n) {
                    bits[i]++;
                } else {
                    bits[i]--;
                }
            }
        }

        let hash = 0n;
        for (let i = 0; i < 64; i++) {
            if (bits[i] > 0) {
                hash |= (1n << BigInt(i));
            }
        }
        return hash;
    }

    /** FNV-1a 64-bit 해시 (의존성 없음) */
    private fnv1a64(str: string): bigint {
        let hash = 0xcbf29ce484222325n;
        for (let i = 0; i < str.length; i++) {
            hash ^= BigInt(str.charCodeAt(i));
            hash = BigInt.asUintN(64, hash * 0x100000001b3n);
        }
        return hash;
    }

    /** 해밍 거리 (비트 불일치 수) */
    public hammingDistance(a: bigint, b: bigint): number {
        let xor = a ^ b;
        let dist = 0;
        while (xor > 0n) {
            dist += Number(xor & 1n);
            xor >>= 1n;
        }
        return dist;
    }

    /** 유사도: 1 - (hamming / 64) */
    public similarity(a: bigint, b: bigint): number {
        return 1 - this.hammingDistance(a, b) / 64;
    }

    /** 문서 인덱싱 */
    public index(noteName: string, content: string): void {
        this.embeddings.set(noteName, this.simhash(content));
    }

    /** 질의와 모든 문서의 유사도 순으로 정렬 */
    public search(query: string): string[] {
        const queryHash = this.simhash(query);
        const scored: Array<[string, number]> = [];

        for (const [name, docHash] of this.embeddings) {
            scored.push([name, this.similarity(queryHash, docHash)]);
        }

        return scored
            .sort((a, b) => b[1] - a[1])
            .map(([name]) => name);
    }
}
```

### 영향 범위

| 파일 | 변경 내용 |
|:-----|:---------|
| `local-embedding.ts` | **신규 생성** — SimHash 엔진 |
| `hybrid-search.ts` | `search()`, `fuseResults()` — 4번째 엔진 추가 |
| `retrieval-weights.ts` | `EngineWeights`에 `semantic` 필드 추가 |
| `context-provider.ts` | `indexKnowledge()`에서 `LocalEmbedding.index()` 호출 |

### 성능 영향

| 항목 | 값 |
|:-----|:---|
| SimHash 생성 | O(n-gram 수) ≈ O(문서 길이) |
| 검색 | O(N × 64-bit popcount) — 매우 빠름 |
| 메모리 | 문서당 8 bytes (64-bit bigint) |
| **예상 인덱싱 지연** | 1,000 문서 기준 < 50ms |
| **예상 검색 지연** | < 1ms |

### 리스크 평가

| 리스크 | 심각도 | 완화 전략 |
|:-------|:------:|:---------|
| SimHash 정밀도가 진짜 임베딩보다 낮음 | 중간 | RRF 융합으로 보완 — 단독 사용 아님 |
| `BigInt` 성능 (구 브라우저) | 낮음 | Node.js 12+ / 모든 현대 브라우저 지원 |
| `EngineWeights` 인터페이스 변경 → 하위 호환성 | 중간 | `semantic` 기본값 1.0, optional로 선언 |

### 구현 난이도: `중간` 🟡 (포팅)
### 의존성 추가: **없음**

---

## 제안 5: ONNX 경량 임베딩 (onnxruntime-node)

### 현황

제안 4의 SimHash는 **구문 유사도**만 포착한다. "dependency injection"과 "DI 패턴"은 문자열이 완전히 다르므로 SimHash로도 매칭이 어렵다.

**진짜 의미 매칭**을 위해서는 학습된 임베딩 모델이 필요하다.

### 제안 요약

`all-MiniLM-L6-v2` INT8 양자화 모델(~22MB)을 `onnxruntime-node`로 로드하여 **진정한 의미 기반 검색**을 추가한다.

### 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│              ONNX Embedding Pipeline                      │
│                                                          │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │ 문서/질의 │────▶│ Tokenizer    │────▶│ ONNX Runtime │ │
│  │ (string) │     │ (wordpiece)  │     │ INT8 추론    │ │
│  └──────────┘     └──────────────┘     └──────┬───────┘ │
│                                               │         │
│                                               ▼         │
│                                      384-dim float[]    │
│                                               │         │
│                                               ▼         │
│                                     cosine similarity   │
└──────────────────────────────────────────────────────────┘
```

### 제안 4와의 차이

| 항목 | 제안 4 (SimHash) | 제안 5 (ONNX) |
|:-----|:----------------|:--------------|
| 유사도 종류 | 구문적 (n-gram) | 의미적 (transformer) |
| 모델 파일 | 없음 | ~22MB ONNX 파일 |
| 의존성 | 없음 | `onnxruntime-node` |
| 정밀도 | 낮음~중간 | 높음 |
| 추론 속도 | < 1ms | ~50ms/문서 (CPU) |
| 브라우저 호환 | ✅ | ⚠️ onnxruntime-web 필요 |
| 오프라인 | ✅ | ✅ (모델 파일 로컬) |

### 구현 스케치

```typescript
// onnx-embedding.ts (신규 파일)

import { InferenceSession, Tensor } from "onnxruntime-node";

export class OnnxEmbedding {
    private session: InferenceSession | null = null;
    private embeddings: Map<string, Float32Array> = new Map();

    async init(modelPath: string): Promise<void> {
        this.session = await InferenceSession.create(modelPath, {
            executionProviders: ["cpu"],
            graphOptimizationLevel: "all",
        });
    }

    async embed(text: string): Promise<Float32Array> {
        if (!this.session) throw new Error("Session not initialized");
        const tokenIds = this.tokenize(text);  // WordPiece tokenizer 필요
        const inputTensor = new Tensor("int64", tokenIds, [1, tokenIds.length]);
        const attentionMask = new Tensor(
            "int64",
            new BigInt64Array(tokenIds.length).fill(1n),
            [1, tokenIds.length],
        );
        const results = await this.session.run({
            input_ids: inputTensor,
            attention_mask: attentionMask,
        });
        // Mean pooling → 384-dim vector
        return this.meanPool(results["last_hidden_state"].data as Float32Array);
    }

    cosineSimilarity(a: Float32Array, b: Float32Array): number {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot   += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
    }

    // ... tokenize(), meanPool() 등 구현 필요
}
```

### 성능 영향

| 항목 | 값 |
|:-----|:---|
| 모델 로딩 | ~500ms (초기 1회) |
| 문서 임베딩 | ~50ms/문서 (CPU, INT8) |
| 검색 (코사인 유사도) | O(N × 384) — 1,000 문서 < 5ms |
| 메모리 | 문서당 1.5KB (384 × 4 bytes) + 모델 ~50MB resident |
| 디스크 | 모델 파일 ~22MB |

### 리스크 평가

| 리스크 | 심각도 | 완화 전략 |
|:-------|:------:|:---------|
| `onnxruntime-node` 네이티브 의존성 | 높음 | Optional peer dependency로 선언 |
| 모델 파일 배포/업데이트 | 중간 | 첫 실행 시 자동 다운로드 + 캐시 |
| 인덱싱 시간 증가 (50ms × N) | 중간 | 증분 인덱싱 + 임베딩 캐시 |
| 브라우저 호환성 | 중간 | `onnxruntime-web` 폴백 또는 제안 4로 폴백 |
| 토크나이저 구현 복잡도 | 중간 | `tokenizers` WASM 패키지 또는 직접 WordPiece 구현 |

### 구현 난이도: `중간-높음` 🟠
### 의존성 추가: `onnxruntime-node` + 모델 파일 (~22MB)

---

## 제안 6: 역할별 가중치 자율 학습 (Online Weight Learning)

### 현황

`ROLE_WEIGHTS`가 하드코딩되어 있다 (`retrieval-weights.ts:28-37`):

```typescript
// retrieval-weights.ts:28-37
export const ROLE_WEIGHTS: Record<string, EngineWeights> = {
    planner:   { lexical: 0.8, tag: 1.1, graph: 1.3 },
    worker:    { lexical: 1.3, tag: 1.0, graph: 0.7 },
    reviewer:  { lexical: 1.0, tag: 1.2, graph: 1.0 },
    commander: { lexical: 1,   tag: 1,   graph: 1   },
};
```

이 값들은 **직관에 기반한 초기값**이며, 실제 사용 패턴에 최적화되지 않았다.

### 제안 요약

사용자의 **암묵적 피드백**(결과 클릭, 컨텍스트 사용 여부)을 기반으로 역할별 가중치를 **온라인 학습**한다.

### 설계

```
┌──────────────────────────────────────────────────────────────┐
│              Online Weight Learning Loop                      │
│                                                              │
│  ┌─────────┐     ┌──────────────┐     ┌──────────────────┐  │
│  │ 검색 수행│────▶│ 결과 반환    │────▶│ 사용자 상호작용  │  │
│  │         │     │ + matchType  │     │ (클릭/사용 여부) │  │
│  └─────────┘     └──────────────┘     └────────┬─────────┘  │
│                                                │              │
│                                                ▼              │
│                                   ┌────────────────────┐     │
│                                   │ Feedback Signal     │     │
│                                   │ {role, engine, +/-} │     │
│                                   └────────┬───────────┘     │
│                                            │                  │
│                                            ▼                  │
│                               ┌────────────────────┐         │
│                               │ EWA 가중치 업데이트 │         │
│                               │ w_new = α×signal   │         │
│                               │       + (1-α)×w_old│         │
│                               └────────┬───────────┘         │
│                                        │                      │
│                                        ▼                      │
│                           weights.json에 저장 (영속)          │
└──────────────────────────────────────────────────────────────┘
```

### 구현 스케치

```typescript
// weight-learner.ts (신규 파일)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { EngineWeights } from "./retrieval-weights.js";

/** EWA 학습률 — 새 피드백의 반영 비율 */
const LEARNING_RATE = 0.05;
/** 가중치 하한 — 완전 소거 방지 */
const MIN_WEIGHT = 0.3;
/** 가중치 상한 — 과적합 방지 */
const MAX_WEIGHT = 2.0;

interface FeedbackSignal {
    role: string;
    /** 사용자가 실제 사용한 결과의 matchType */
    usedEngine: keyof EngineWeights;
    /** +1: 유용했음, -1: 무시됨 */
    signal: 1 | -1;
}

export class WeightLearner {
    private learnedWeights: Record<string, EngineWeights> = {};
    private persistPath: string;

    constructor(persistPath: string) {
        this.persistPath = persistPath;
        this.load();
    }

    private load(): void {
        if (existsSync(this.persistPath)) {
            try {
                this.learnedWeights = JSON.parse(
                    readFileSync(this.persistPath, "utf8")
                );
            } catch {
                this.learnedWeights = {};
            }
        }
    }

    private save(): void {
        writeFileSync(
            this.persistPath,
            JSON.stringify(this.learnedWeights, null, 2),
        );
    }

    /**
     * 피드백 신호를 반영하여 가중치를 업데이트한다.
     * EWA(Exponentially Weighted Average) 방식.
     */
    public update(feedback: FeedbackSignal): void {
        const { role, usedEngine, signal } = feedback;
        if (!this.learnedWeights[role]) {
            this.learnedWeights[role] = { lexical: 1, tag: 1, graph: 1 };
        }
        const w = this.learnedWeights[role];
        const current = w[usedEngine] ?? 1;
        const nudge = signal > 0 ? 1.1 : 0.9;   // +10% / -10%
        const updated = LEARNING_RATE * (current * nudge)
                      + (1 - LEARNING_RATE) * current;
        w[usedEngine] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, updated));
        this.save();
    }

    /** 학습된 가중치를 반환. 없으면 null → 호출자가 기본값 사용. */
    public getWeights(role: string): EngineWeights | null {
        return this.learnedWeights[role] ?? null;
    }
}
```

### `weightsForRole()` 변경

```typescript
// retrieval-weights.ts — 변경

import { WeightLearner } from "./weight-learner.js";

let learner: WeightLearner | null = null;

export function initWeightLearner(persistPath: string): void {
    learner = new WeightLearner(persistPath);
}

export function weightsForRole(role?: string | null): EngineWeights {
    if (!role) return NEUTRAL_WEIGHTS;
    // 학습된 가중치 우선, 없으면 하드코딩 기본값
    const learned = learner?.getWeights(role.toLowerCase());
    return learned ?? ROLE_WEIGHTS[role.toLowerCase()] ?? NEUTRAL_WEIGHTS;
}
```

### 성능 영향

| 항목 | 값 |
|:-----|:---|
| 피드백 처리 | O(1) — 단순 EWA 갱신 |
| 파일 I/O | 피드백당 1회 writeFileSync (~수백 bytes) |
| 메모리 | 역할 수 × EngineWeights 크기 (무시 가능) |

### 리스크 평가

| 리스크 | 심각도 | 완화 전략 |
|:-------|:------:|:---------|
| 잘못된 피드백 → 가중치 발산 | 중간 | MIN/MAX 클램프 + 리셋 기능 |
| 피드백 수집 지점 정의 모호 | 중간 | 명확한 이벤트 정의 (컨텍스트 채택 = +1) |
| 초기 학습 데이터 부족 | 낮음 | 하드코딩 기본값으로 폴백 |

### 구현 난이도: `중간` 🟡
### 의존성 추가: **없음**

---

## 제안 7: Learning-to-Rank — RRF 대체

### 현황

현재 RRF 공식 (`hybrid-search.ts:179`):

```typescript
// hybrid-search.ts:179
const rrfScore = weight * (1 / (RRF_K + i + 1));
```

RRF는 **순위만** 사용하고 **실제 점수 크기**를 무시한다. 1위와 2위 점수 차이가 0.001이든 100이든 동일하게 처리된다.

### 제안 요약

경량 **결정트리(GBDT) 또는 로지스틱 회귀**로 각 엔진의 **원점수(raw score)**를 피처로 받아 최적 결합을 학습한다. RRF를 완전히 대체한다.

### 설계

```
┌──────────────────────────────────────────────────────────────────┐
│                Learning-to-Rank Pipeline                         │
│                                                                  │
│  ┌────────────────────────────────────┐                          │
│  │  피처 벡터 (문서별)                 │                          │
│  │  [bm25_score,                      │                          │
│  │   tag_match_count,                 │                          │
│  │   graph_depth_score,               │                          │
│  │   simhash_similarity,              │  ← 각 엔진의 원점수      │
│  │   onnx_cosine_sim,                 │                          │
│  │   query_term_count,                │  ← 메타 피처             │
│  │   doc_length_ratio]                │                          │
│  └──────────┬─────────────────────────┘                          │
│             │                                                    │
│             ▼                                                    │
│  ┌────────────────────────────────────┐                          │
│  │  경량 모델                          │                          │
│  │  Option A: Logistic Regression     │ ← 가장 단순, 해석 가능   │
│  │  Option B: 소형 GBDT (depth=3, 10T)│ ← 비선형 포착            │
│  │  Option C: LambdaMART-lite         │ ← 순위 최적화 전용       │
│  └──────────┬─────────────────────────┘                          │
│             │                                                    │
│             ▼                                                    │
│        relevance_score (0~1)                                     │
│             │                                                    │
│             ▼                                                    │
│        정렬 → Top-N 반환                                         │
└──────────────────────────────────────────────────────────────────┘
```

### Before / After — `fuseResults()` 대체

**Before** (RRF 기반):
```typescript
// hybrid-search.ts:149-166
private fuseResults(lexical, tags, graph, limit, weights): SearchResult[] {
    const fused = new Map();
    this.addRrfScores(fused, lexical, "lexical", weights.lexical);
    this.addRrfScores(fused, tags,    "tag",     weights.tag);
    this.addRrfScores(fused, graph,   "graph",   weights.graph);
    // ... 정렬 및 반환
}
```

**After** (LtR 기반):
```typescript
private fuseResults(
    rawScores: Map<string, FeatureVector>,
    limit: number,
): SearchResult[] {
    const scored: Array<[string, number]> = [];
    for (const [noteName, features] of rawScores) {
        const relevance = this.ranker.predict(features);
        scored.push([noteName, relevance]);
    }
    return scored
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([noteName, score]) => ({
            noteName,
            score,
            matchType: this.dominantEngine(rawScores.get(noteName)!),
        }));
}
```

### 구현 스케치 — 로지스틱 회귀 (가장 단순한 시작점)

```typescript
// ltr-ranker.ts (신규 파일)

export interface FeatureVector {
    bm25Score: number;
    tagMatchCount: number;
    graphScore: number;
    simhashSimilarity: number;
    queryTermCount: number;
    docLengthRatio: number;
}

/**
 * 미니 로지스틱 회귀 랭커.
 * 가중치는 피드백 로그로 오프라인 학습하거나,
 * WeightLearner와 연계하여 온라인 SGD로 학습.
 */
export class LtrRanker {
    private weights: number[];
    private bias: number;

    constructor(weights?: number[], bias?: number) {
        // 6개 피처에 대한 초기 가중치
        this.weights = weights ?? [0.4, 0.2, 0.15, 0.15, 0.05, 0.05];
        this.bias = bias ?? 0;
    }

    /** 시그모이드 예측 */
    predict(features: FeatureVector): number {
        const x = [
            features.bm25Score,
            features.tagMatchCount,
            features.graphScore,
            features.simhashSimilarity,
            features.queryTermCount,
            features.docLengthRatio,
        ];
        let z = this.bias;
        for (let i = 0; i < x.length; i++) {
            z += this.weights[i] * x[i];
        }
        return 1 / (1 + Math.exp(-z));
    }

    /**
     * 온라인 SGD 업데이트.
     * label: 1 (사용됨) / 0 (무시됨)
     */
    update(features: FeatureVector, label: number, lr: number = 0.01): void {
        const pred = this.predict(features);
        const error = label - pred;
        const x = [
            features.bm25Score,
            features.tagMatchCount,
            features.graphScore,
            features.simhashSimilarity,
            features.queryTermCount,
            features.docLengthRatio,
        ];
        for (let i = 0; i < this.weights.length; i++) {
            this.weights[i] += lr * error * x[i];
        }
        this.bias += lr * error;
    }
}
```

### 학습 데이터 수집

```
┌──────────────────────────────────────────────────────────┐
│              Training Data Pipeline                       │
│                                                          │
│  1. 검색 수행 → 결과 + 피처 벡터 로깅                     │
│  2. 사용자 상호작용 관찰                                  │
│     - 결과 채택 → label=1                                │
│     - 결과 무시 → label=0                                │
│  3. (query, doc, features, label) 저장                   │
│  4. 배치 학습 or 온라인 SGD                               │
└──────────────────────────────────────────────────────────┘
```

### 성능 영향

| 항목 | 값 |
|:-----|:---|
| 예측 | O(피처 수) — < 0.01ms |
| 학습 (온라인 SGD) | O(피처 수) — < 0.01ms/샘플 |
| 메모리 | 가중치 배열 수십 bytes |
| 모델 저장 | JSON 수백 bytes |

### 리스크 평가

| 리스크 | 심각도 | 완화 전략 |
|:-------|:------:|:---------|
| 학습 데이터 부족 시 RRF보다 나쁠 수 있음 | 높음 | 최소 샘플 수 미달 시 RRF 폴백 |
| 피처 스케일 불균형 | 중간 | 피처 정규화 (z-score or min-max) |
| 콜드 스타트 문제 | 높음 | RRF를 기본값으로 유지하고 데이터 축적 후 전환 |
| 과적합 (작은 코퍼스) | 중간 | L2 정규화 추가 |

### 구현 난이도: `높음` 🔴
### 의존성 추가: **없음** (순수 TypeScript 구현)

---

## 우선순위 매트릭스

```
                    영향도 (Impact)
            낮음          중간          높음
        ┌──────────┬──────────────┬──────────────┐
  낮음  │          │              │  제안 1      │
        │          │              │  PageRank    │
구 ─────┼──────────┼──────────────┼──────────────┤
현      │          │  제안 2      │  제안 4      │
난 중간 │          │  위치인덱스   │  해시임베딩   │
이      │          │  제안 3      │  제안 6      │
도      │          │  질의확장    │  가중치학습   │
  ─────┼──────────┼──────────────┼──────────────┤
  높음  │          │  제안 5      │  제안 7      │
        │          │  ONNX       │  LtR         │
        └──────────┴──────────────┴──────────────┘
```

| 우선순위 | 제안 | 구현 난이도 | 영향도 | 의존성 | ROI |
|:--------:|:-----|:----------:|:------:|:------:|:---:|
| **1** | 제안 1: PageRank 그래프 스코어링 | 🟢 낮음 | 높음 | 없음 | ⭐⭐⭐⭐⭐ |
| **2** | 제안 4: 로컬 해시 임베딩 | 🟡 중간 | 높음 | 없음 | ⭐⭐⭐⭐ |
| **3** | 제안 2: 위치 인덱스 + 구문 근접 | 🟡 중간 | 중간 | 없음 | ⭐⭐⭐⭐ |
| **4** | 제안 6: 역할별 가중치 학습 | 🟡 중간 | 높음 | 없음 | ⭐⭐⭐⭐ |
| **5** | 제안 3: 코퍼스 기반 질의 확장 | 🟡 중간 | 중간 | 없음 | ⭐⭐⭐ |
| **6** | 제안 5: ONNX 경량 임베딩 | 🟠 중간-높음 | 중간 | onnxruntime-node | ⭐⭐⭐ |
| **7** | 제안 7: Learning-to-Rank | 🔴 높음 | 높음 | 없음 | ⭐⭐ |

---

## 구현 로드맵

```
────────────────────────────────────────────────────────────────────────
 Week  1    2    3    4    5    6    7    8    9   10   11   12+
────────────────────────────────────────────────────────────────────────

Phase 1 ████████
  제안 1: PageRank      ████
  제안 4: 해시 임베딩        ████████

Phase 2          ████████████
  제안 2: 위치 인덱스         ████████
  제안 3: 질의 확장               ████████

Phase 3                       ████████████████
  제안 5: ONNX 임베딩              ████████████
  제안 6: 가중치 학습                   ████████

Phase 4                                        ████████████
  제안 7: LtR                                  ████████████

────────────────────────────────────────────────────────────────────────
```

### Phase 1 (1~2주): 기반 강화 — PageRank + 해시 임베딩

| 주차 | 작업 | 산출물 |
|:----:|:-----|:------|
| 1 | `GraphParser.computePageRank()` 구현 + 테스트 | `graph-parser.ts` 변경 |
| 1 | `traverseGraph()`에 PR 보너스 통합 | `hybrid-search.ts` 변경 |
| 2 | `LocalEmbedding` 클래스 구현 | `local-embedding.ts` 신규 |
| 2 | `EngineWeights` 확장 + 4-way RRF 통합 | `retrieval-weights.ts`, `hybrid-search.ts` 변경 |
| 2 | `context-provider.ts`에서 LocalEmbedding 인덱싱 연결 | `context-provider.ts` 변경 |

**마일스톤**: 4-way 하이브리드 검색 동작 확인 (기존 테스트 + 새 시맨틱 테스트)

### Phase 2 (2~4주): 정밀도 향상 — 위치 인덱스 + 질의 확장

| 주차 | 작업 | 산출물 |
|:----:|:-----|:------|
| 3 | `getTermPositions()` + `computeProximityBonus()` 구현 | `hybrid-search.ts` 변경 |
| 3 | `lexicalSearch()` 리팩터링 + 벤치마크 | 성능 보고서 |
| 4 | `buildCooccurrenceMatrix()` + `expandQuery()` 구현 | `hybrid-search.ts` 변경 |
| 4 | PMI 임계값 튜닝 + 확장 품질 검증 | 튜닝 보고서 |

**마일스톤**: 구문 근접 + 질의 확장으로 recall 향상 검증

### Phase 3 (4~8주): 시맨틱 + 적응 — ONNX 임베딩 + 가중치 학습

| 주차 | 작업 | 산출물 |
|:----:|:-----|:------|
| 5-6 | `OnnxEmbedding` 클래스 + 토크나이저 구현 | `onnx-embedding.ts` 신규 |
| 6 | 모델 다운로드/캐시 매니저 | `model-manager.ts` 신규 |
| 7 | 5-way RRF 통합 (SimHash + ONNX 공존) | `hybrid-search.ts` 변경 |
| 7-8 | `WeightLearner` 구현 + 피드백 수집 파이프라인 | `weight-learner.ts` 신규 |
| 8 | A/B 테스트 프레임워크 (학습 가중치 vs 하드코딩) | 비교 보고서 |

**마일스톤**: 진짜 의미 검색 + 적응형 가중치 동작 확인

### Phase 4 (8주+): LtR — RRF 완전 대체

| 주차 | 작업 | 산출물 |
|:----:|:-----|:------|
| 9-10 | 피처 벡터 정의 + 학습 데이터 수집 파이프라인 | `ltr-ranker.ts` 신규 |
| 10-11 | 로지스틱 회귀 → 미니 GBDT 단계적 구현 | `ltr-ranker.ts` 확장 |
| 11-12 | RRF ↔ LtR 전환 스위치 + 폴백 로직 | `hybrid-search.ts` 변경 |
| 12+ | 프로덕션 배포 + 모니터링 | 배포 보고서 |

**마일스톤**: 학습 데이터 기반 최적 결합으로 검색 품질 측정 가능한 개선

---

## 최종 아키텍처 비전 (Phase 4 완료 후)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Enhanced Search Pipeline                          │
│                                                                      │
│  Query                                                               │
│    │                                                                 │
│    ├── Co-occurrence Expansion ──→ expanded_terms                    │
│    │                                                                 │
│    ├── BM25 + Proximity ──────────→ bm25_score + prox_bonus         │
│    │                                                                 │
│    ├── Tag Search ────────────────→ tag_match_count                  │
│    │                                                                 │
│    ├── Graph + PageRank ──────────→ graph_score + pr_bonus           │
│    │                                                                 │
│    ├── SimHash (local) ───────────→ simhash_similarity               │
│    │                                                                 │
│    └── ONNX Embedding (opt) ──────→ cosine_similarity                │
│                                                                      │
│         ┌──────────────────────────────────────────┐                 │
│         │  Feature Vector (문서별)                   │                 │
│         │  [bm25, prox, tag, graph, pr, simhash,   │                 │
│         │   onnx_cos, query_len, doc_len_ratio]    │                 │
│         └──────────────────┬───────────────────────┘                 │
│                            │                                         │
│                            ▼                                         │
│              ┌───────────────────────────┐                           │
│              │  LtR Ranker               │                           │
│              │  (학습 데이터 충분)         │                           │
│              │  OR                        │                           │
│              │  RRF + Adaptive Weights   │                           │
│              │  (폴백 / 콜드 스타트)       │                           │
│              └─────────────┬─────────────┘                           │
│                            │                                         │
│                            ▼                                         │
│                     Top-N SearchResult[]                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 파일 변경 총괄

| 파일 | Phase | 변경 유형 |
|:-----|:-----:|:---------|
| `graph-parser.ts` | 1 | `computePageRank()`, `getPageRankScore()` 추가 |
| `local-embedding.ts` | 1 | **신규** — SimHash 엔진 |
| `retrieval-weights.ts` | 1, 3 | `EngineWeights.semantic` 추가 + learner 연동 |
| `hybrid-search.ts` | 1, 2, 3, 4 | 4→5-way 융합, 위치 인덱스, 질의 확장, LtR 통합 |
| `context-provider.ts` | 1, 3 | 인덱싱 파이프라인 확장 |
| `weight-learner.ts` | 3 | **신규** — 온라인 가중치 학습 |
| `onnx-embedding.ts` | 3 | **신규** — ONNX 임베딩 (Optional) |
| `model-manager.ts` | 3 | **신규** — 모델 다운로드/캐시 |
| `ltr-ranker.ts` | 4 | **신규** — Learning-to-Rank 랭커 |

---

## 검증 전략

### 오프라인 평가 메트릭

| 메트릭 | 설명 | 목표 |
|:-------|:-----|:-----|
| **MRR@10** | Mean Reciprocal Rank at 10 | ≥ 0.6 (현행 추정 0.4) |
| **NDCG@10** | Normalized DCG at 10 | ≥ 0.7 |
| **Recall@20** | 상위 20건 내 관련 문서 포함율 | ≥ 0.8 |
| **P@3** | 상위 3건 정밀도 (컨텍스트 반영 기준) | ≥ 0.7 |

### 평가 데이터셋 구축

```
1. 현행 시스템 로그에서 (query, selected_result) 쌍 수집
2. 수동 레이블링: 50+ 질의 × 관련도 3단계 (0/1/2)
3. 각 Phase 완료 시 동일 데이터셋으로 회귀 비교
```

### 성능 버짓

| 항목 | 허용치 |
|:-----|:------|
| 인덱싱 (1,000 문서) | < 2초 |
| 검색 지연 (P99) | < 50ms |
| 메모리 (인덱스 상주) | < 100MB |
| 디스크 (ONNX 모델 제외) | < 1MB |

---

## 부록: 제약 조건 준수 매트릭스

| 제약 조건 | 제안 1 | 제안 2 | 제안 3 | 제안 4 | 제안 5 | 제안 6 | 제안 7 |
|:---------|:------:|:------:|:------:|:------:|:------:|:------:|:------:|
| GPU 없음 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 외부 모델 없음 | ✅ | ✅ | ✅ | ✅ | ⚠️¹ | ✅ | ✅ |
| 외부 API 없음 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CPU 전용 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 브라우저 호환 | ✅ | ✅ | ✅ | ✅ | ⚠️² | ✅ | ✅ |
| 의존성 추가 없음 | ✅ | ✅ | ✅ | ✅ | ❌³ | ✅ | ✅ |

> ¹ ONNX 모델 파일(~22MB)이 로컬에 필요하나, 외부 API 호출은 없음
> ² `onnxruntime-web`으로 대체 가능하나 WASM 로딩 오버헤드 존재
> ³ `onnxruntime-node` 네이티브 의존성 추가 필요

---

*작성: AI Agent · 2026-06-19 · opencode-orchestrator 검색 시스템 고도화 제안*

---

# Part 2: 기억 감쇄 (Memory Decay) 고도화

> **문제 정의**: 지식 볼트에 메모리가 계속 쌓이기만 하면 검색 노이즈 증가, 저장 비용 증가, 오래된 정보가 최신 정보를 밀어내는 **컨텍스트 부패(context rot)** 현상이 발생한다.
> opencode-orchestrator는 현재 `memory-consolidation.ts`에 기본적인 분석 로직이 있으나, **능동적 감쇄·자동 압축·충돌 해소**는 미구현 상태이다.

---

## 현행 기억 수명주기 분석

| 메커니즘 | 파일 | 동작 | 한계 |
|:--|:--|:--|:--|
| **미션 메모리** | `mission-memory.ts` | 생성된 미션 노트 동기화 및 stale generated note 삭제 | 시간/접근 기반 감쇄 없음 |
| **그래프 유지보수** | `memory-consolidation.ts` | 고아/대형/태그중복 분석, MOC 초안 생성 | side-effect-free 분석만; 백링크 동기화/아카이브 실행 없음 |
| **Safety Guards** | `safety-guards.ts` | 순환 감지, 동시 쓰기 큐 | 무결성만, 감쇄 무관 |
| **Scratchpad** | `scratchpad.ts` | LRU 레지스터 캐시 (최대 64 entries, entry 4KB cap) | 세션/런타임 보조 기억이며 장기 볼트 감쇄와 별개 |

```
현행 수명주기:

생성 → 볼트 잔류 중심 → generated note stale 삭제/수동 삭제
                          ↑
                  시간·접근 기반 자동 감쇄/압축 없음
```

---

## 제안 8: 접근 빈도 추적 (Usage-Aware Priority)

> **난이도**: 🟢 낮음 | **의존성**: 없음 | **영향**: 전체 검색 품질

### 현재

검색 결과로 반환되어도 **접근 기록이 없다**. 핵심 SOP와 한 번도 안 쓰인 고아 노트가 동일 취급.

### 제안

frontmatter에 접근 메타데이터를 추가하고, 검색 시 RRF 점수에 반영한다.

```yaml
# 노트 frontmatter에 추가되는 필드
---
tags: [sop]
access_count: 47
last_accessed: 2026-06-18T14:30:00Z
---
```

```typescript
// hybrid-search.ts — 검색 결과 반환 시 접근 기록 갱신
function recordAccess(note: ParsedNote): void {
  note.frontmatter.access_count = (note.frontmatter.access_count ?? 0) + 1;
  note.frontmatter.last_accessed = new Date().toISOString();
  // frontmatter를 파일에 다시 기록 (tag-indexer.ts의 파서 활용)
}

// RRF 점수에 가산
function usageBonus(note: ParsedNote): number {
  const count = note.frontmatter.access_count ?? 0;
  return Math.log(count + 1) * 0.05; // 로그 스케일
}
```

### 구현 위치

| 파일 | 변경 |
|:--|:--|
| `tag-indexer.ts` | frontmatter에 `access_count`, `last_accessed` 파싱 추가 |
| `hybrid-search.ts` | `fuseResults()`에서 `usageBonus` 가산 |
| `context-provider.ts` | 검색 결과 반환 시 `recordAccess()` 호출 |

---

## 제안 9: 적응형 지수 감쇄 — FadeMem 패턴

> **난이도**: 🟡 중간 | **의존성**: 없음 | **영향**: 검색 정밀도 + 저장 절감
> **참조**: FadeMem (arXiv:2601.18642, 2026.01) — 에빙하우스 망각 곡선 기반

### 원리

모든 메모리에 **강도(strength)**를 부여하고, 시간이 지남에 따라 지수적으로 감쇄한다.

```
strength(t) = e^(-λ × Δt) × frequencyBoost

λ = 기본 감쇄 상수 (태그 기반으로 결정)
Δt = (현재 시각 - 마지막 접근 시각) / 1일
frequencyBoost = 1 + ln(accessCount + 1) / 10
```

### 태그별 감쇄 속도

```
┌──────────────────────────────────────────────────────┐
│  strength                                            │
│  1.0 ┤ ●                                             │
│      │  ╲  sop (λ=0.01, 반감기 69일)                  │
│  0.8 ┤   ╲                                           │
│      │    ╲╲  reference (λ=0.03, 반감기 23일)         │
│  0.6 ┤     ╲ ╲                                       │
│      │      ╲  ╲╲  episodic (λ=0.07, 반감기 10일)    │
│  0.4 ┤       ╲   ╲╲                                  │
│      │        ╲    ╲╲╲                               │
│  0.2 ┤ --------╲-----╲╲----- 압축 임계값 (0.2)       │
│      │          ╲      ╲╲╲                           │
│  0.0 ┤───────────╲───────╲╲──── 아카이브 임계값 (0.05)│
│      └─────┬─────┬─────┬─────┬─────── 경과 일수      │
│            10    20    30    60                       │
└──────────────────────────────────────────────────────┘
```

```typescript
// retrieval-weights.ts — 태그별 감쇄 상수
const DECAY_RATES: Record<string, number> = {
  sop:       0.01,  // 반감기 69일
  playbook:  0.02,  // 반감기 35일
  reference: 0.03,  // 반감기 23일
  episodic:  0.07,  // 반감기 10일
  scratch:   0.15,  // 반감기 5일
};

function decayRate(tags: string[]): number {
  for (const tag of tags) {
    if (tag in DECAY_RATES) return DECAY_RATES[tag];
  }
  return 0.03; // 기본값: reference 수준
}

// hybrid-search.ts — 검색 점수에 감쇄 적용
function memoryStrength(note: ParsedNote): number {
  const lambda = decayRate(note.frontmatter.tags ?? []);
  const lastAccessed = new Date(note.frontmatter.last_accessed ?? note.frontmatter.created ?? Date.now());
  const daysSince = (Date.now() - lastAccessed.getTime()) / 86_400_000;
  const accessCount = note.frontmatter.access_count ?? 0;
  const decay = Math.exp(-lambda * daysSince);
  const freqBoost = 1 + Math.log(accessCount + 1) / 10;
  return Math.max(0.05, Math.min(1.0, decay * freqBoost));
}
```

### 임계값 도달 시 자동 조치

```
strength > 0.2  → 정상 (검색 결과에 포함)
strength ≤ 0.2  → 압축 대상 (요약 → 팩트 노트로 증류)
strength ≤ 0.05 → 아카이브 대상 (archives/ 이동)
```

### FadeMem 벤치마크 참고 성과

- 스토리지 **45% 절감**
- 멀티홉 추론 정확도 유지 (LoCoMo 벤치마크)

---

## 제안 10: 계층적 압축 파이프라인 (Tiered Consolidation)

> **난이도**: 🟡 중간 | **의존성**: 없음 | **영향**: 저장 구조 전면 개선
> **참조**: Letta/Mem0 등 장기 메모리 시스템의 계층화 패턴 (2025~2026 공개 자료 기준)

### 현행 vs 제안

```
현행:
  Scratchpad (최대 64 entries) ──────────────── 볼트 잔류 중심
  ← Working memory와 장기 볼트 사이의 Warm/Cold 요약 티어 없음

제안:
  ┌────────────────────────────────────────────────────────────┐
  │ Tier 1: Working Memory (Scratchpad)                       │
  │ TTL: 세션 종료 시 소멸                                      │
  │ 형태: LRU 레지스터 (현행 유지)                               │
  ├────────────────────────────────────────────────────────────┤
  │ Tier 2: Episodic Memory (에피소드 기억)                     │
  │ TTL: 7~30일 (strength 기반 감쇄)                            │
  │ 형태: 미션 단위 실행 로그                                    │
  │ 감쇄 후: → LLM 증류 → Tier 3                               │
  ├────────────────────────────────────────────────────────────┤
  │ Tier 3: Semantic Memory (의미 기억)                         │
  │ TTL: 무기한 (충돌 시에만 갱신)                               │
  │ 형태: 증류된 팩트/선호/규칙                                  │
  ├────────────────────────────────────────────────────────────┤
  │ Tier 4: Archive (아카이브)                                  │
  │ 형태: 압축된 원본 보존                                       │
  │ 역할: 감사 추적, 필요 시 복원                                │
  └────────────────────────────────────────────────────────────┘
```

### 컴팩션 파이프라인

```typescript
// memory-consolidation.ts — 새 메서드
async function compact(notes: ParsedNote[]): Promise<CompactionResult> {
  const result: CompactionResult = { promoted: [], archived: [], distilled: [] };
  
  for (const note of notes) {
    const strength = memoryStrength(note);
    const tier = note.frontmatter.tier ?? 'episodic';
    
    if (tier === 'episodic' && strength <= 0.05) {
      // Tier 2 → Tier 4: 아카이브
      await moveToArchive(note);
      result.archived.push(note.path);
    } else if (tier === 'episodic' && strength <= 0.2) {
      // Tier 2 → Tier 3: LLM 증류
      const fact = await distillToFact(note); // LLM 요약
      await saveFact(fact);
      await moveToArchive(note);
      result.distilled.push(note.path);
    }
  }
  return result;
}
```

### 구현 위치

| 파일 | 변경 |
|:--|:--|
| `tag-indexer.ts` | frontmatter에 `tier` 필드 파싱 |
| `memory-consolidation.ts` | `compact()` 메서드 추가 |
| `hybrid-search.ts` | Tier 1-3만 검색, Tier 4 제외 |
| `context-provider.ts` | 초기화 시 컴팩션 트리거 |

---

## 제안 11: 충돌 기반 망각 (Conflict-Driven Forgetting)

> **난이도**: 🟠 중간-높음 | **의존성**: 없음 | **영향**: 팩트 정확도

### 문제

```
기존 노트: "Node.js 18에서는 fetch가 experimental이다"
새 정보:   "Node.js 22에서는 fetch가 stable이다"

현행: 둘 다 저장 → 검색 시 구버전이 먼저 나올 수 있음
```

### 제안

```typescript
// memory-consolidation.ts — 새 노트 저장 시 충돌 체크
async function conflictCheck(
  newNote: ParsedNote, 
  existingNotes: ParsedNote[],
  search: HybridSearch
): Promise<ConflictResolution> {
  // 1. 기존 노트 중 유사도 상위 5건 추출
  const candidates = search.search(newNote.content, 'worker', 5);
  
  for (const hit of candidates) {
    if (hit.score < 0.6) continue; // 무관
    
    // 2. 같은 태그 + 높은 유사도 → 충돌 후보
    const tagOverlap = intersect(newNote.tags, hit.tags).length;
    if (tagOverlap === 0) continue;
    
    // 3. 판정
    if (isSuperseding(newNote, hit)) {
      await moveToArchive(hit.note);  // 구 노트 아카이브
      inheritLinks(newNote, hit.note); // 링크 승계
      return { action: 'replaced', old: hit.path };
    }
  }
  return { action: 'none' };
}
```

---

## 제안 12: A-Mem 자율 링킹 — 에이전트 주도 그래프 성장

> **난이도**: 🔴 높음 | **의존성**: 없음 | **영향**: 그래프 품질
> **참조**: A-Mem (NeurIPS 2025) — 제텔카스텐 기반 자율 메모리

### 현재

위키링크 `[[target]]`는 **사람이 직접 작성**해야 생긴다. 에이전트가 노트를 생성해도 링크를 안 달면 고아가 된다.

### 제안

노트 저장 시 에이전트가 **자동으로 관련 노트를 찾아 양방향 링크를 생성**한다.

```typescript
// graph-parser.ts — 새 메서드
function suggestLinks(
  newNote: ParsedNote,
  existingNotes: ParsedNote[],
  search: HybridSearch,
  maxLinks: number = 3
): SuggestedLink[] {
  const hits = search.search(newNote.content, 'worker', maxLinks * 2);
  
  return hits
    .filter(hit => hit.path !== newNote.path && hit.score >= 0.7)
    .slice(0, maxLinks)
    .map(hit => ({
      target: hit.path,
      score: hit.score,
      wikiLink: `[[${basename(hit.path, '.md')}]]`
    }));
}

// 저장 후 자동 링크 삽입
async function autoLink(note: ParsedNote): Promise<void> {
  const suggestions = suggestLinks(note, allNotes, hybridSearch);
  
  // 새 노트에 링크 추가
  const linkSection = suggestions
    .map(s => `- ${s.wikiLink}`)
    .join('\n');
  note.content += `\n\n## 관련 노트\n${linkSection}\n`;
  
  // 대상 노트에 역방향 링크 추가
  for (const s of suggestions) {
    await appendBacklink(s.target, note.path);
  }
}
```

### A-Mem 핵심 원칙

```
1. 원자성: 모든 메모리는 독립적이고 자기 완결적
2. 연결성: 유사한 메모리는 자동으로 연결
3. 진화성: 새 정보가 기존 메모리의 컨텍스트를 갱신
4. 자율성: 에이전트가 인간 개입 없이 그래프를 관리
```

---

## 기억 감쇄 우선순위 매트릭스

| 순서 | 제안 | 영향도 | 난이도 | 의존성 | 선행 조건 |
|:----:|:-----|:------:|:------:|:------:|:---------|
| **1** | ⑧ 접근 빈도 추적 | ⭐⭐⭐ | 🟢 낮음 | 없음 | 없음 |
| **2** | ⑨ 적응형 지수 감쇄 | ⭐⭐⭐⭐ | 🟡 중간 | 없음 | 제안 8 |
| **3** | ⑩ 계층적 압축 | ⭐⭐⭐⭐⭐ | 🟡 중간 | 없음 | 제안 8, 9 |
| **4** | ⑪ 충돌 기반 망각 | ⭐⭐⭐ | 🟠 중간-높음 | 없음 | 없음 |
| **5** | ⑫ A-Mem 자율 링킹 | ⭐⭐⭐⭐ | 🔴 높음 | 없음 | 제안 8 |

## 기억 감쇄 구현 로드맵

```
Phase A (1-2주):  제안 8 — frontmatter 확장 + 접근 카운터
Phase B (2-4주):  제안 9 — 감쇄 함수 + RRF 점수 반영
Phase C (4-8주):  제안 10 — 4-Tier 구조 + 컴팩션 파이프라인
Phase D (8주+):   제안 11, 12 — 충돌 감지 + 자율 링킹
```

---

*작성: AI Agent · 2026-06-19 · opencode-orchestrator 검색 시스템 고도화 제안 (Part 1: 검색 고도화 제안 1~7, Part 2: 기억 감쇄 제안 8~12)*
