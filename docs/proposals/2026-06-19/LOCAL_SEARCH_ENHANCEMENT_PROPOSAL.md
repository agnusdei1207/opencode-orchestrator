# Local-First Search Enhancement Proposal

> **opencode-orchestrator** next-generation evolution roadmap for the hybrid search system

---

## Metadata

| Item | Value |
|:-----|:---|
| **Date** | 2026-06-19 |
| **Target Project** | opencode-orchestrator (TypeScript / Node.js) |
| **Current System** | BM25 lexical + tag search + wikilink graph 2-hop BFS + RRF fusion + role-based weighting |
| **Constraints** | No GPU · No external model files · No external API · CPU-only · Browser compatibility considered |
| **Core Files** | `hybrid-search.ts` · `retrieval-weights.ts` · `tag-indexer.ts` · `graph-parser.ts` · `context-provider.ts` |

---

## Current System Analysis

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    KnowledgeContextProvider                             │
│  context-provider.ts:20  ─ buildPrompt() orchestration                  │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐                         │
│  │TagIndexer│    │GraphParser│    │HybridSearch│                         │
│  │tag-index │    │graph-pars│    │hybrid-sear │                         │
│  │er.ts:16  │    │er.ts:5   │    │ch.ts:28    │                         │
│  └────┬─────┘    └─────┬────┘    └──────┬─────┘                         │
│       │                │               │                                │
│       ▼                ▼               ▼                                │
│   frontmatter      wikilink        BM25 lexical                        │
│   tag parsing      bidirectional   TF-IDF scoring                      │
│                    graph                                                │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │         RRF Fusion  (K=60)  ×  role-based weighting           │       │
│  │         hybrid-search.ts:149  fuseResults()                   │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                              ▼                                          │
│                    SearchResult[] (Top-N)                                │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Component Details

#### 1. BM25 Lexical Search — `hybrid-search.ts:66-89`

```typescript
// hybrid-search.ts:72-86
private lexicalSearch(terms: string[]): string[] {
    const scores = new Map<string, number>();
    const avgLen = this.computeAverageLength();        // L78: character-based average length

    for (const term of terms) {
        const df = this.documentFrequency(term);       // L74: full scan O(N)
        const idf = Math.log((corpusSize - df + 0.5) / (df + 0.5) + 1);  // L75

        for (const [name, content] of this.contentMap) {
            const tf = this.countOccurrences(content, term);  // L78: indexOf loop
            // BM25 normalization  K1=1.2, B=0.75
            const tfNorm = (tf * (BM25_K1 + 1)) /
                (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avgLen)));
        }
    }
}
```

**Current Limitations:**
- `countOccurrences()` (L198-206) is a simple `indexOf` loop → **discards position information**
- Cannot distinguish whether query terms `["error", "handling"]` appear in the same sentence or 1000 lines apart
- `documentFrequency()` (L218-224) performs a **full scan on every query** → O(terms × docs)

#### 2. Tag Search — `tag-indexer.ts:16-207`

```typescript
// tag-indexer.ts:82-95
public indexFile(filePath: string, fileContent: string): void {
    const { data } = this.parseFrontmatter(fileContent);
    // Extracts only the tags array from the YAML frontmatter
    if (data.tags && Array.isArray(data.tags)) {
        for (const tag of data.tags) {
            this.addTagEntry(tag.toLowerCase(), filePath);
        }
    }
}
```

- O(1) tag lookup (`tagMap: Map<string, Set<string>>`, L17)
- Frontmatter-only — **inline hashtags (`#topic`) in the body are ignored**

#### 3. Graph Search — `graph-parser.ts:5-152` + `hybrid-search.ts:110-143`

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
        scores.set(neighbor, prev + depth);           // L140: depth-based score only
        this.traverseGraph(neighbor, depth - 1, ...); // L141: recursive 2-hop
    }
}
```

**Current Limitations:**
- All neighbors receive the same score based on the depth value → **cannot distinguish hub notes vs. leaf notes**
- Does not reflect graph structural importance (link count, connectivity centrality) at all

#### 4. RRF Fusion + Role-Based Weighting — `hybrid-search.ts:149-190` + `retrieval-weights.ts:16-42`

```typescript
// retrieval-weights.ts:28-37
export const ROLE_WEIGHTS: Record<string, EngineWeights> = {
    planner:   { lexical: 0.8, tag: 1.1, graph: 1.3 },  // L30: prefers structure
    worker:    { lexical: 1.3, tag: 1.0, graph: 0.7 },  // L32: prefers exact matching
    reviewer:  { lexical: 1.0, tag: 1.2, graph: 1.0 },  // L34: prefers tag coverage
    commander: { lexical: 1,   tag: 1,   graph: 1   },  // L36: neutral
};
```

- **3-way RRF**: `score(d) = Σ weight_i / (60 + rank_i + 1)` (L179)
- Weights are **hardcoded** → cannot incorporate user feedback
- **No semantic channel at all** → cannot retrieve synonyms or semantically similar documents

#### 5. Orchestration — `context-provider.ts:20-129`

```typescript
// context-provider.ts:65-90
private indexKnowledge(directory, files): IndexedKnowledge {
    const tagIndexer = new TagIndexer();
    const graphParser = new GraphParser();
    const search = new HybridSearch(tagIndexer, graphParser);
    // ... per-file indexing loop
    tagIndexer.indexFile(filePath, content);     // L79
    graphParser.indexFile(filePath, content);    // L80
    search.indexContent(noteName, normalizedBody); // L81
}
```

- **Full re-indexing on every query** (L65-90) — no caching or incremental indexing
- Fixed at `MAX_RESULTS = 3` (L8) and `MAX_SNIPPET_CHARS = 220` (L9)

---

## Summary of Current System Weaknesses

```
┌──────────────────────────────────────────────────────────┐
│                Current Search Pipeline Weaknesses          │
├──────────────────┬───────────────────────────────────────┤
│ Weakness         │ Impact                                 │
├──────────────────┼───────────────────────────────────────┤
│ Position info lost  │ Ignores "error handling" proximity   │
│ No semantic channel │ Cannot search synonyms/similar ideas │
│ No hub distinction  │ Important & leaf notes scored equally │
│ No query expansion  │ Matches only literal terms           │
│ Hardcoded weights   │ Cannot adapt to usage patterns       │
│ Fixed RRF formula   │ Cannot learn optimal combination     │
│ Re-index per query  │ Latency grows with corpus size       │
└──────────────────┴───────────────────────────────────────┘
```

---

## Proposal 1: PageRank Graph Scoring

### Current State

`graphSearch()` (hybrid-search.ts:110-119) performs a 2-hop BFS from the seed note and uses only the `depth` value as the score:

```typescript
// hybrid-search.ts:139-140
const prev = scores.get(neighbor) ?? 0;
scores.set(neighbor, prev + depth);  // depth=2 yields 2 points, depth=1 yields 1 point
```

This approach treats **all neighbors equally**. A hub note linked from 10 notes receives the same weight as a leaf note referenced by only 1 note.

### Proposal Summary

Add a `pagerank()` method to `GraphParser` to quantify the **structural importance** of the entire graph. Add this PageRank score to the depth-based score in `traverseGraph()` so that hub notes naturally rise to the top.

### Design

```
┌────────────────────────────────────────────────────────────┐
│             PageRank Integration Pipeline                  │
│                                                            │
│  After indexFile() call                                    │
│       │                                                    │
│       ▼                                                    │
│  GraphParser.computePageRank()                             │
│       │  20 iterations (damping=0.85)                      │
│       ▼                                                    │
│  Map<noteName, prScore>                                    │
│       │                                                    │
│       ▼                                                    │
│  traverseGraph() score = depth + α × pagerank(neighbor)   │
│       │                                                    │
│       ▼                                                    │
│  RRF fusion (existing pipeline)                            │
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

### Implementation Sketch — Added to `graph-parser.ts`

```typescript
// graph-parser.ts — new method

private pageRankScores: Map<string, number> = new Map();

/**
 * Power-iteration PageRank. CPU-only, no dependencies.
 * O(iterations × edges) — tens of ms on a typical knowledge base.
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

    // Initial value: uniform distribution
    for (const note of allNotes) {
        pr.set(note, 1 / N);
    }

    // Iterate to convergence
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

### Performance Impact

| Item | Value |
|:-----|:---|
| **Time Complexity** | O(iterations × edges) ≈ O(20 × E) |
| **Expected Latency** | < 10ms for 1,000 notes / 5,000 edges |
| **Memory** | 1 additional Map (note count × 8 bytes) |
| **Indexing Point** | Called once after `indexKnowledge()` completes |

### Risk Assessment

| Risk | Severity | Mitigation Strategy |
|:-------|:------:|:---------|
| Dangling notes (0 outlinks) → sink problem | Low | The `(1-d)/N` teleport term auto-corrects |
| Recomputation cost on graph changes | Low | Already re-indexes per query, so additional cost is negligible |
| PR score range mismatches scale of depth score | Medium | Adjustable via `PR_ALPHA` coefficient (default 10.0 recommended) |

### Implementation Difficulty: `Low` 🟢
### Added Dependencies: **None**

---

## Proposal 2: Position Index + Phrase Proximity Bonus (Proximity Scoring)

### Current State

`countOccurrences()` (hybrid-search.ts:198-206) counts only the **number of occurrences** of a term and **discards position information**:

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

For the query `"error handling"`:
- Document A: "error" ... (500 chars later) ... "handling" → 2 points
- Document B: "error handling strategy" → 2 points
- **Both documents score identically** — a clear loss of information

### Proposal Summary

Replace `countOccurrences()` with `getTermPositions()`, which **returns a list of positions**, and add a proximity bonus based on the **minimum distance (span)** between query term pairs to the BM25 score.

### Design

```
┌───────────────────────────────────────────────────────────┐
│              Proximity Scoring Pipeline                    │
│                                                           │
│  terms = ["error", "handling"]                            │
│                                                           │
│  Per document:                                            │
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
// ... after BM25 computation ...
const proximityBonus = this.computeProximityBonus(allPositions);
scores.set(name, prev + idf * tfNorm + PROX_WEIGHT * proximityBonus);
```

### Implementation Sketch

```typescript
// hybrid-search.ts — new methods

/** Proximity bonus weight */
const PROX_WEIGHT = 0.5;
/** Proximity window (in characters) */
const PROX_WINDOW = 50;

/**
 * Returns all occurrence positions of a term.
 * Replaces countOccurrences().
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
 * Computes a proximity bonus based on the minimum distance between query term pairs.
 * Maximum bonus when the minimum span of all term pairs is within PROX_WINDOW.
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
 * Computes the minimum distance between two sorted position arrays using an O(n+m) two-pointer scan.
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

### Code to Modify (lexicalSearch changes)

```typescript
// hybrid-search.ts:66-89  after changes
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

### Performance Impact

| Item | Current | After Changes |
|:-----|:-----|:--------|
| `countOccurrences` return | `number` | `number[]` (position array) |
| Additional memory | None | Temporary position arrays per query (GC'd after query completes) |
| Additional CPU | None | Two-pointer O(n+m) × number of term pairs |
| **Expected Added Latency** | — | < 1ms (for 1,000 documents) |

### Risk Assessment

| Risk | Severity | Mitigation Strategy |
|:-------|:------:|:---------|
| Excessive proximity bonus in short documents | Low | Can be normalized relative to document length |
| Bonus is 0 for single-term queries | None | Returns 0 when `termList.length < 2` (by design) |

### Implementation Difficulty: `Medium` 🟡
### Added Dependencies: **None**

---

## Proposal 3: Corpus-Based Query Expansion (Co-occurrence Query Expansion)

### Current State

The current `tokenize()` (hybrid-search.ts:193-195) splits the query on whitespace and searches **as-is**:

```typescript
// hybrid-search.ts:193-195
private tokenize(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter(Boolean);
}
```

Searching for the query `"refactoring"` cannot find documents containing semantically equivalent terms like `"code cleanup"`, `"restructuring"`, or `"code improvement"`.

### Proposal Summary

Collect **co-occurrence statistics** within the corpus and automatically add terms that show a high correlation with the query terms. Query expansion is performed using **only the corpus's own statistics**, without any external model or embeddings.

### Design

```
┌─────────────────────────────────────────────────────────────┐
│             Co-occurrence Query Expansion                    │
│                                                             │
│  At indexing time (once):                                  │
│  ┌─────────────────────────────────────────┐                │
│  │ For every term pair in all documents     │                │
│  │ cooccurrence[termA][termB] += 1          │                │
│  │ (count when they co-occur in one doc)    │                │
│  └─────────────────────────────────────────┘                │
│                                                             │
│  At query time:                                            │
│  query = ["error"]                                          │
│       │                                                     │
│       ▼                                                     │
│  co-occurrence("error") → {handling: 42, log: 38, ...}      │
│       │                                                     │
│       ▼                                                     │
│  PMI filter: PMI(error, handling) > threshold?              │
│       │                                                     │
│       ▼                                                     │
│  expanded = ["error", "handling"]   (weight 0.5)           │
│       │                                                     │
│       ▼                                                     │
│  lexicalSearch(expanded)                                    │
└─────────────────────────────────────────────────────────────┘
```

### PMI (Pointwise Mutual Information) Based Filtering

Use **PMI** rather than raw frequency to select only meaningful related terms:

```
PMI(x, y) = log₂( P(x,y) / (P(x) × P(y)) )

P(x,y) = probability that terms x and y appear in the same document
P(x)   = probability that term x appears
```

A high PMI means they co-occur more often than chance → strong semantic association.

### Implementation Sketch

```typescript
// hybrid-search.ts — new fields and methods

/** Co-occurrence matrix: term → Map<term, count> */
private cooccurrence: Map<string, Map<string, number>> = new Map();
/** Document frequency: term → df */
private dfCache: Map<string, number> = new Map();

/** Maximum number of query expansion candidates */
const MAX_EXPANSION_TERMS = 3;
/** PMI lower-bound threshold */
const PMI_THRESHOLD = 1.0;
/** Expansion term weight (original terms are 1.0) */
const EXPANSION_WEIGHT = 0.5;

/**
 * Called after indexing completes — builds the co-occurrence matrix.
 * Counts unique term pairs in each document.
 */
public buildCooccurrenceMatrix(): void {
    this.cooccurrence.clear();
    this.dfCache.clear();

    for (const [, content] of this.contentMap) {
        const docTerms = [...new Set(content.split(/\s+/).filter(t => t.length > 2))];
        for (const term of docTerms) {
            this.dfCache.set(term, (this.dfCache.get(term) ?? 0) + 1);
        }
        // Count term-pair co-occurrences (limit to top frequent terms to cap O(T²))
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
 * PMI-based query expansion.
 * Returns up to MAX_EXPANSION_TERMS terms with high co-occurrence frequency with the original terms.
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

### Performance Impact

| Item | Value |
|:-----|:---|
| Building co-occurrence matrix | O(docs × T²) — T capped at 200 |
| Query expansion | O(number of co-occurrence entries) — usually a few hundred |
| Memory | Sparse Map structure — a few MB for 1,000 documents |

### Risk Assessment

| Risk | Severity | Mitigation Strategy |
|:-------|:------:|:---------|
| Expansion terms diverge in meaning (topic drift) | Medium | PMI threshold + cap of 3 |
| Statistical instability on small corpora | Medium | Minimum df filter (df ≥ 3) |
| Matrix memory usage | Low | Cap of 200 terms per document |

### Implementation Difficulty: `Medium` 🟡
### Added Dependencies: **None**

---

## Proposal 4: Add Local Hash Embeddings (New Dense Channel)

### Current State

The current `HybridSearch` has only 3 engines:

```typescript
// hybrid-search.ts:55-57
const lexicalRanked  = this.lexicalSearch(terms);   // Engine 1: BM25
const tagRanked      = this.tagSearch(terms);       // Engine 2: tags
const graphRanked    = this.graphSearch(terms);      // Engine 3: graph

// retrieval-weights.ts:16-20
export interface EngineWeights {
    lexical: number;
    tag: number;
    graph: number;
    // ❌ no semantic field
}
```

**There is no semantic search channel at all.** Searching for "dependency injection" cannot find a document expressed as "the DI pattern".

### Proposal Summary

Add a **SimHash / MinHash-based local hash embedding** as a 4th engine.
This computes inter-document similarity using **only n-gram hashes**, without any external model.

### Design

```
┌────────────────────────────────────────────────────────────────┐
│            Hash Embedding Dense Channel                        │
│                                                                │
│  At indexing time:                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │ document  │───▶│ extract      │───▶│ SimHash      │          │
│  │ content   │    │ char 3-gram  │    │ 64-bit vector│          │
│  └──────────┘    └──────────────┘    └──────┬───────┘          │
│                                             │                  │
│                                             ▼                  │
│                                    embeddings: Map<name, u64>  │
│                                                                │
│  At query time:                                                │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  query   │───▶│ extract      │───▶│ SimHash      │          │
│  │          │    │ char 3-gram  │    │ 64-bit vector│          │
│  └──────────┘    └──────────────┘    └──────┬───────┘          │
│                                             │                  │
│                                             ▼                  │
│                      compare with all docs via hamming dist    │
│                                             │                  │
│                                             ▼                  │
│                      sort by similarity → ranked list          │
└────────────────────────────────────────────────────────────────┘
```

### Before / After — `EngineWeights` Changes

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
    semantic: number;      // ← new field
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

### Before / After — `fuseResults()` 4-way Change

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

### Implementation Sketch — `local-embedding.ts` (new file)

```typescript
/**
 * LocalEmbedding - SimHash-based local hash embedding.
 * No external model/API required. CPU-only, browser-compatible.
 */
export class LocalEmbedding {
    private embeddings: Map<string, bigint> = new Map();

    /** Extract char n-grams */
    private charNgrams(text: string, n: number = 3): string[] {
        const grams: string[] = [];
        const lower = text.toLowerCase().replace(/\s+/g, " ");
        for (let i = 0; i <= lower.length - n; i++) {
            grams.push(lower.slice(i, i + n));
        }
        return grams;
    }

    /**
     * SimHash: generates a 64-bit fingerprint.
     * Hashes each n-gram and votes per bit with weighting.
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

    /** FNV-1a 64-bit hash (no dependencies) */
    private fnv1a64(str: string): bigint {
        let hash = 0xcbf29ce484222325n;
        for (let i = 0; i < str.length; i++) {
            hash ^= BigInt(str.charCodeAt(i));
            hash = BigInt.asUintN(64, hash * 0x100000001b3n);
        }
        return hash;
    }

    /** Hamming distance (number of mismatched bits) */
    public hammingDistance(a: bigint, b: bigint): number {
        let xor = a ^ b;
        let dist = 0;
        while (xor > 0n) {
            dist += Number(xor & 1n);
            xor >>= 1n;
        }
        return dist;
    }

    /** Similarity: 1 - (hamming / 64) */
    public similarity(a: bigint, b: bigint): number {
        return 1 - this.hammingDistance(a, b) / 64;
    }

    /** Document indexing */
    public index(noteName: string, content: string): void {
        this.embeddings.set(noteName, this.simhash(content));
    }

    /** Sort all documents by similarity to the query */
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

### Scope of Impact

| File | Change |
|:-----|:---------|
| `local-embedding.ts` | **Newly created** — SimHash engine |
| `hybrid-search.ts` | `search()`, `fuseResults()` — add 4th engine |
| `retrieval-weights.ts` | Add `semantic` field to `EngineWeights` |
| `context-provider.ts` | Call `LocalEmbedding.index()` in `indexKnowledge()` |

### Performance Impact

| Item | Value |
|:-----|:---|
| SimHash generation | O(number of n-grams) ≈ O(document length) |
| Search | O(N × 64-bit popcount) — very fast |
| Memory | 8 bytes per document (64-bit bigint) |
| **Expected Indexing Latency** | < 50ms for 1,000 documents |
| **Expected Search Latency** | < 1ms |

### Risk Assessment

| Risk | Severity | Mitigation Strategy |
|:-------|:------:|:---------|
| SimHash precision lower than a real embedding | Medium | Compensated by RRF fusion — not used alone |
| `BigInt` performance (older browsers) | Low | Supported on Node.js 12+ / all modern browsers |
| `EngineWeights` interface change → backward compatibility | Medium | Declare `semantic` as optional with default 1.0 |

### Implementation Difficulty: `Medium` 🟡 (porting)
### Added Dependencies: **None**

---

## Proposal 5: ONNX Lightweight Embeddings (onnxruntime-node)

### Current State

The SimHash from Proposal 4 captures only **syntactic similarity**. Since "dependency injection" and "the DI pattern" are completely different strings, even SimHash struggles to match them.

**True semantic matching** requires a trained embedding model.

### Proposal Summary

Load the `all-MiniLM-L6-v2` INT8 quantized model (~22MB) via `onnxruntime-node` to add **true meaning-based search**.

### Architecture

```
┌──────────────────────────────────────────────────────────┐
│              ONNX Embedding Pipeline                      │
│                                                          │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │ doc/query │────▶│ Tokenizer    │────▶│ ONNX Runtime │ │
│  │ (string) │     │ (wordpiece)  │     │ INT8 inference│ │
│  └──────────┘     └──────────────┘     └──────┬───────┘ │
│                                               │         │
│                                               ▼         │
│                                      384-dim float[]    │
│                                               │         │
│                                               ▼         │
│                                     cosine similarity   │
└──────────────────────────────────────────────────────────┘
```

### Differences from Proposal 4

| Item | Proposal 4 (SimHash) | Proposal 5 (ONNX) |
|:-----|:----------------|:--------------|
| Similarity type | Syntactic (n-gram) | Semantic (transformer) |
| Model file | None | ~22MB ONNX file |
| Dependencies | None | `onnxruntime-node` |
| Precision | Low–medium | High |
| Inference speed | < 1ms | ~50ms/doc (CPU) |
| Browser compatible | ✅ | ⚠️ requires onnxruntime-web |
| Offline | ✅ | ✅ (model file is local) |

### Implementation Sketch

```typescript
// onnx-embedding.ts (new file)

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
        const tokenIds = this.tokenize(text);  // WordPiece tokenizer required
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

    // ... tokenize(), meanPool(), etc. need to be implemented
}
```

### Performance Impact

| Item | Value |
|:-----|:---|
| Model loading | ~500ms (once at startup) |
| Document embedding | ~50ms/doc (CPU, INT8) |
| Search (cosine similarity) | O(N × 384) — < 5ms for 1,000 docs |
| Memory | 1.5KB per doc (384 × 4 bytes) + model ~50MB resident |
| Disk | Model file ~22MB |

### Risk Assessment

| Risk | Severity | Mitigation Strategy |
|:-------|:------:|:---------|
| `onnxruntime-node` native dependency | High | Declare as optional peer dependency |
| Model file distribution/updates | Medium | Auto-download + cache on first run |
| Increased indexing time (50ms × N) | Medium | Incremental indexing + embedding cache |
| Browser compatibility | Medium | Fall back to `onnxruntime-web` or to Proposal 4 |
| Tokenizer implementation complexity | Medium | `tokenizers` WASM package or a direct WordPiece implementation |

### Implementation Difficulty: `Medium–High` 🟠
### Added Dependencies: `onnxruntime-node` + model file (~22MB)

---

## Proposal 6: Autonomous Role-Based Weight Learning (Online Weight Learning)

### Current State

`ROLE_WEIGHTS` is hardcoded (`retrieval-weights.ts:28-37`):

```typescript
// retrieval-weights.ts:28-37
export const ROLE_WEIGHTS: Record<string, EngineWeights> = {
    planner:   { lexical: 0.8, tag: 1.1, graph: 1.3 },
    worker:    { lexical: 1.3, tag: 1.0, graph: 0.7 },
    reviewer:  { lexical: 1.0, tag: 1.2, graph: 1.0 },
    commander: { lexical: 1,   tag: 1,   graph: 1   },
};
```

These values are **intuition-based initial values** that are not optimized for actual usage patterns.

### Proposal Summary

**Online-learn** role-based weights based on the user's **implicit feedback** (result clicks, whether the context was used).

### Design

```
┌──────────────────────────────────────────────────────────────┐
│              Online Weight Learning Loop                      │
│                                                              │
│  ┌─────────┐     ┌──────────────┐     ┌──────────────────┐  │
│  │ perform │────▶│ return       │────▶│ user interaction │  │
│  │ search  │     │ results      │     │ (click/used?)    │  │
│  │         │     │ + matchType  │     │                  │  │
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
│                               │ EWA weight update  │         │
│                               │ w_new = α×signal   │         │
│                               │       + (1-α)×w_old│         │
│                               └────────┬───────────┘         │
│                                        │                      │
│                                        ▼                      │
│                           persist to weights.json            │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Sketch

```typescript
// weight-learner.ts (new file)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { EngineWeights } from "./retrieval-weights.js";

/** EWA learning rate — the fraction by which new feedback is incorporated */
const LEARNING_RATE = 0.05;
/** Weight lower bound — prevents complete elimination */
const MIN_WEIGHT = 0.3;
/** Weight upper bound — prevents overfitting */
const MAX_WEIGHT = 2.0;

interface FeedbackSignal {
    role: string;
    /** matchType of the result the user actually used */
    usedEngine: keyof EngineWeights;
    /** +1: was useful, -1: ignored */
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
     * Updates weights by incorporating a feedback signal.
     * Uses an EWA (Exponentially Weighted Average) approach.
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

    /** Returns the learned weights. Returns null if none → caller uses defaults. */
    public getWeights(role: string): EngineWeights | null {
        return this.learnedWeights[role] ?? null;
    }
}
```

### `weightsForRole()` Changes

```typescript
// retrieval-weights.ts — changes

import { WeightLearner } from "./weight-learner.js";

let learner: WeightLearner | null = null;

export function initWeightLearner(persistPath: string): void {
    learner = new WeightLearner(persistPath);
}

export function weightsForRole(role?: string | null): EngineWeights {
    if (!role) return NEUTRAL_WEIGHTS;
    // Prefer learned weights, fall back to hardcoded defaults
    const learned = learner?.getWeights(role.toLowerCase());
    return learned ?? ROLE_WEIGHTS[role.toLowerCase()] ?? NEUTRAL_WEIGHTS;
}
```

### Performance Impact

| Item | Value |
|:-----|:---|
| Feedback processing | O(1) — simple EWA update |
| File I/O | One writeFileSync per feedback (~a few hundred bytes) |
| Memory | Number of roles × EngineWeights size (negligible) |

### Risk Assessment

| Risk | Severity | Mitigation Strategy |
|:-------|:------:|:---------|
| Bad feedback → weight divergence | Medium | MIN/MAX clamp + reset capability |
| Ambiguous definition of feedback collection points | Medium | Clear event definitions (context adopted = +1) |
| Insufficient initial training data | Low | Fall back to hardcoded defaults |

### Implementation Difficulty: `Medium` 🟡
### Added Dependencies: **None**

---

## Proposal 7: Learning-to-Rank — Replacing RRF

### Current State

The current RRF formula (`hybrid-search.ts:179`):

```typescript
// hybrid-search.ts:179
const rrfScore = weight * (1 / (RRF_K + i + 1));
```

RRF uses **only rank** and ignores the **actual score magnitude**. Whether the score difference between 1st and 2nd place is 0.001 or 100, it is treated identically.

### Proposal Summary

Use a lightweight **decision tree (GBDT) or logistic regression** that takes each engine's **raw score** as a feature and learns the optimal combination. This completely replaces RRF.

### Design

```
┌──────────────────────────────────────────────────────────────────┐
│                Learning-to-Rank Pipeline                         │
│                                                                  │
│  ┌────────────────────────────────────┐                          │
│  │  feature vector (per document)      │                          │
│  │  [bm25_score,                      │                          │
│  │   tag_match_count,                 │                          │
│  │   graph_depth_score,               │                          │
│  │   simhash_similarity,              │  ← raw score per engine  │
│  │   onnx_cosine_sim,                 │                          │
│  │   query_term_count,                │  ← meta features         │
│  │   doc_length_ratio]                │                          │
│  └──────────┬─────────────────────────┘                          │
│             │                                                    │
│             ▼                                                    │
│  ┌────────────────────────────────────┐                          │
│  │  lightweight model                  │                          │
│  │  Option A: Logistic Regression     │ ← simplest, interpretable│
│  │  Option B: small GBDT (depth=3,10T)│ ← captures non-linearity │
│  │  Option C: LambdaMART-lite         │ ← rank-optimization only │
│  └──────────┬─────────────────────────┘                          │
│             │                                                    │
│             ▼                                                    │
│        relevance_score (0~1)                                     │
│             │                                                    │
│             ▼                                                    │
│        sort → return Top-N                                       │
└──────────────────────────────────────────────────────────────────┘
```

### Before / After — Replacing `fuseResults()`

**Before** (RRF-based):
```typescript
// hybrid-search.ts:149-166
private fuseResults(lexical, tags, graph, limit, weights): SearchResult[] {
    const fused = new Map();
    this.addRrfScores(fused, lexical, "lexical", weights.lexical);
    this.addRrfScores(fused, tags,    "tag",     weights.tag);
    this.addRrfScores(fused, graph,   "graph",   weights.graph);
    // ... sort and return
}
```

**After** (LtR-based):
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

### Implementation Sketch — Logistic Regression (the simplest starting point)

```typescript
// ltr-ranker.ts (new file)

export interface FeatureVector {
    bm25Score: number;
    tagMatchCount: number;
    graphScore: number;
    simhashSimilarity: number;
    queryTermCount: number;
    docLengthRatio: number;
}

/**
 * Mini logistic regression ranker.
 * Weights can be trained offline from feedback logs,
 * or trained online via SGD in conjunction with WeightLearner.
 */
export class LtrRanker {
    private weights: number[];
    private bias: number;

    constructor(weights?: number[], bias?: number) {
        // Initial weights for the 6 features
        this.weights = weights ?? [0.4, 0.2, 0.15, 0.15, 0.05, 0.05];
        this.bias = bias ?? 0;
    }

    /** Sigmoid prediction */
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
     * Online SGD update.
     * label: 1 (used) / 0 (ignored)
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

### Training Data Collection

```
┌──────────────────────────────────────────────────────────┐
│              Training Data Pipeline                       │
│                                                          │
│  1. Perform search → log results + feature vectors        │
│  2. Observe user interaction                              │
│     - Result adopted → label=1                           │
│     - Result ignored → label=0                           │
│  3. Store (query, doc, features, label)                  │
│  4. Batch training or online SGD                         │
└──────────────────────────────────────────────────────────┘
```

### Performance Impact

| Item | Value |
|:-----|:---|
| Prediction | O(number of features) — < 0.01ms |
| Training (online SGD) | O(number of features) — < 0.01ms/sample |
| Memory | Weight array, a few dozen bytes |
| Model storage | JSON, a few hundred bytes |

### Risk Assessment

| Risk | Severity | Mitigation Strategy |
|:-------|:------:|:---------|
| May be worse than RRF when training data is insufficient | High | Fall back to RRF below a minimum sample count |
| Feature scale imbalance | Medium | Feature normalization (z-score or min-max) |
| Cold-start problem | High | Keep RRF as the default and switch after accumulating data |
| Overfitting (small corpus) | Medium | Add L2 regularization |

### Implementation Difficulty: `High` 🔴
### Added Dependencies: **None** (pure TypeScript implementation)

---

## Priority Matrix

```
                    Impact
            Low           Medium        High
        ┌──────────┬──────────────┬──────────────┐
  Low   │          │              │  Proposal 1  │
        │          │              │  PageRank    │
        ├──────────┼──────────────┼──────────────┤
Diff-   │          │  Proposal 2  │  Proposal 4  │
iculty  │          │  Position idx│  Hash embed  │
 Medium │          │  Proposal 3  │  Proposal 6  │
        │          │  Query expand│  Weight learn│
        ├──────────┼──────────────┼──────────────┤
  High  │          │  Proposal 5  │  Proposal 7  │
        │          │  ONNX       │  LtR         │
        └──────────┴──────────────┴──────────────┘
```

| Priority | Proposal | Implementation Difficulty | Impact | Dependencies | ROI |
|:--------:|:-----|:----------:|:------:|:------:|:---:|
| **1** | Proposal 1: PageRank graph scoring | 🟢 Low | High | None | ⭐⭐⭐⭐⭐ |
| **2** | Proposal 4: Local hash embeddings | 🟡 Medium | High | None | ⭐⭐⭐⭐ |
| **3** | Proposal 2: Position index + phrase proximity | 🟡 Medium | Medium | None | ⭐⭐⭐⭐ |
| **4** | Proposal 6: Role-based weight learning | 🟡 Medium | High | None | ⭐⭐⭐⭐ |
| **5** | Proposal 3: Corpus-based query expansion | 🟡 Medium | Medium | None | ⭐⭐⭐ |
| **6** | Proposal 5: ONNX lightweight embeddings | 🟠 Medium–High | Medium | onnxruntime-node | ⭐⭐⭐ |
| **7** | Proposal 7: Learning-to-Rank | 🔴 High | High | None | ⭐⭐ |

---

## Implementation Roadmap

```
────────────────────────────────────────────────────────────────────────
 Week  1    2    3    4    5    6    7    8    9   10   11   12+
────────────────────────────────────────────────────────────────────────

Phase 1 ████████
  Proposal 1: PageRank     ████
  Proposal 4: Hash embed       ████████

Phase 2          ████████████
  Proposal 2: Position idx     ████████
  Proposal 3: Query expand         ████████

Phase 3                       ████████████████
  Proposal 5: ONNX embed          ████████████
  Proposal 6: Weight learn             ████████

Phase 4                                        ████████████
  Proposal 7: LtR                             ████████████

────────────────────────────────────────────────────────────────────────
```

### Phase 1 (Weeks 1–2): Foundation Strengthening — PageRank + Hash Embeddings

| Week | Task | Deliverable |
|:----:|:-----|:------|
| 1 | Implement + test `GraphParser.computePageRank()` | `graph-parser.ts` change |
| 1 | Integrate PR bonus into `traverseGraph()` | `hybrid-search.ts` change |
| 2 | Implement `LocalEmbedding` class | `local-embedding.ts` new |
| 2 | Extend `EngineWeights` + integrate 4-way RRF | `retrieval-weights.ts`, `hybrid-search.ts` change |
| 2 | Wire LocalEmbedding indexing in `context-provider.ts` | `context-provider.ts` change |

**Milestone**: Confirm 4-way hybrid search works (existing tests + new semantic tests)

### Phase 2 (Weeks 2–4): Precision Improvement — Position Index + Query Expansion

| Week | Task | Deliverable |
|:----:|:-----|:------|
| 3 | Implement `getTermPositions()` + `computeProximityBonus()` | `hybrid-search.ts` change |
| 3 | Refactor `lexicalSearch()` + benchmark | Performance report |
| 4 | Implement `buildCooccurrenceMatrix()` + `expandQuery()` | `hybrid-search.ts` change |
| 4 | Tune PMI threshold + validate expansion quality | Tuning report |

**Milestone**: Verify recall improvement from phrase proximity + query expansion

### Phase 3 (Weeks 4–8): Semantic + Adaptive — ONNX Embeddings + Weight Learning

| Week | Task | Deliverable |
|:----:|:-----|:------|
| 5-6 | Implement `OnnxEmbedding` class + tokenizer | `onnx-embedding.ts` new |
| 6 | Model download/cache manager | `model-manager.ts` new |
| 7 | Integrate 5-way RRF (SimHash + ONNX coexisting) | `hybrid-search.ts` change |
| 7-8 | Implement `WeightLearner` + feedback collection pipeline | `weight-learner.ts` new |
| 8 | A/B test framework (learned weights vs. hardcoded) | Comparison report |

**Milestone**: Confirm true semantic search + adaptive weights work

### Phase 4 (Week 8+): LtR — Fully Replace RRF

| Week | Task | Deliverable |
|:----:|:-----|:------|
| 9-10 | Define feature vectors + training data collection pipeline | `ltr-ranker.ts` new |
| 10-11 | Stepwise implementation: logistic regression → mini GBDT | `ltr-ranker.ts` extension |
| 11-12 | RRF ↔ LtR switch + fallback logic | `hybrid-search.ts` change |
| 12+ | Production deployment + monitoring | Deployment report |

**Milestone**: Measurable search-quality improvement from optimal combination based on training data

---

## Final Architecture Vision (After Phase 4 Completion)

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
│         │  Feature Vector (per document)            │                 │
│         │  [bm25, prox, tag, graph, pr, simhash,   │                 │
│         │   onnx_cos, query_len, doc_len_ratio]    │                 │
│         └──────────────────┬───────────────────────┘                 │
│                            │                                         │
│                            ▼                                         │
│              ┌───────────────────────────┐                           │
│              │  LtR Ranker               │                           │
│              │  (sufficient training data)│                           │
│              │  OR                        │                           │
│              │  RRF + Adaptive Weights   │                           │
│              │  (fallback / cold start)  │                           │
│              └─────────────┬─────────────┘                           │
│                            │                                         │
│                            ▼                                         │
│                     Top-N SearchResult[]                              │
└──────────────────────────────────────────────────────────────────────┘
```

### File Change Summary

| File | Phase | Change Type |
|:-----|:-----:|:---------|
| `graph-parser.ts` | 1 | Add `computePageRank()`, `getPageRankScore()` |
| `local-embedding.ts` | 1 | **New** — SimHash engine |
| `retrieval-weights.ts` | 1, 3 | Add `EngineWeights.semantic` + learner integration |
| `hybrid-search.ts` | 1, 2, 3, 4 | 4→5-way fusion, position index, query expansion, LtR integration |
| `context-provider.ts` | 1, 3 | Extend indexing pipeline |
| `weight-learner.ts` | 3 | **New** — online weight learning |
| `onnx-embedding.ts` | 3 | **New** — ONNX embeddings (optional) |
| `model-manager.ts` | 3 | **New** — model download/cache |
| `ltr-ranker.ts` | 4 | **New** — Learning-to-Rank ranker |

---

## Validation Strategy

### Offline Evaluation Metrics

| Metric | Description | Target |
|:-------|:-----|:-----|
| **MRR@10** | Mean Reciprocal Rank at 10 | ≥ 0.6 (current estimate 0.4) |
| **NDCG@10** | Normalized DCG at 10 | ≥ 0.7 |
| **Recall@20** | Fraction of relevant docs within top 20 | ≥ 0.8 |
| **P@3** | Precision of top 3 (based on context inclusion) | ≥ 0.7 |

### Building the Evaluation Dataset

```
1. Collect (query, selected_result) pairs from current system logs
2. Manual labeling: 50+ queries × 3 relevance levels (0/1/2)
3. On each Phase completion, run a regression comparison on the same dataset
```

### Performance Budget

| Item | Allowance |
|:-----|:------|
| Indexing (1,000 docs) | < 2s |
| Search latency (P99) | < 50ms |
| Memory (index resident) | < 100MB |
| Disk (excluding ONNX model) | < 1MB |

---

## Appendix: Constraint Compliance Matrix

| Constraint | Prop 1 | Prop 2 | Prop 3 | Prop 4 | Prop 5 | Prop 6 | Prop 7 |
|:---------|:------:|:------:|:------:|:------:|:------:|:------:|:------:|
| No GPU | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| No external model | ✅ | ✅ | ✅ | ✅ | ⚠️¹ | ✅ | ✅ |
| No external API | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CPU-only | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Browser compatible | ✅ | ✅ | ✅ | ✅ | ⚠️² | ✅ | ✅ |
| No added dependencies | ✅ | ✅ | ✅ | ✅ | ❌³ | ✅ | ✅ |

> ¹ An ONNX model file (~22MB) must be local, but there are no external API calls
> ² Can be substituted with `onnxruntime-web`, but a WASM loading overhead exists
> ³ Requires adding the `onnxruntime-node` native dependency

---

*Authored by: AI Agent · 2026-06-19 · opencode-orchestrator search system enhancement proposal*

---

# Part 2: Memory Decay Enhancement

> **Problem Statement**: If memory keeps accumulating in the knowledge vault unchecked, search noise increases, storage costs rise, and **context rot** occurs as stale information crowds out newer information.
> opencode-orchestrator currently has basic analysis logic in `memory-consolidation.ts`, but **active decay, automatic compaction, and conflict resolution** are not yet implemented.

---

## Current Memory Lifecycle Analysis

| Mechanism | File | Behavior | Limitation |
|:--|:--|:--|:--|
| **Mission Memory** | `mission-memory.ts` | Syncs generated mission notes and deletes stale generated notes | No time/access-based decay |
| **Graph Maintenance** | `memory-consolidation.ts` | Analyzes orphans/large notes/tag duplication, drafts MOCs | Side-effect-free analysis only; does not run backlink sync/archiving |
| **Safety Guards** | `safety-guards.ts` | Cycle detection, concurrent write queue | Integrity only, unrelated to decay |
| **Scratchpad** | `scratchpad.ts` | LRU register cache (max 64 entries, 4KB cap per entry) | A session/runtime auxiliary memory, separate from long-term vault decay |

```
Current lifecycle:

create → vault-retention focused → delete stale generated notes / manual deletion
                          ↑
                  No time-/access-based automatic decay or compaction
```

---

## Proposal 8: Access Frequency Tracking (Usage-Aware Priority)

> **Difficulty**: 🟢 Low | **Dependencies**: None | **Impact**: Overall search quality

### Current State

Even when returned as a search result, there is **no access record**. A core SOP and an orphan note that was never used are treated identically.

### Proposal

Add access metadata to the frontmatter and incorporate it into the RRF score at search time.

```yaml
# Fields added to note frontmatter
---
tags: [sop]
access_count: 47
last_accessed: 2026-06-18T14:30:00Z
---
```

```typescript
// hybrid-search.ts — update access record when returning search results
function recordAccess(note: ParsedNote): void {
  note.frontmatter.access_count = (note.frontmatter.access_count ?? 0) + 1;
  note.frontmatter.last_accessed = new Date().toISOString();
  // Write the frontmatter back to the file (using tag-indexer.ts's parser)
}

// Add to the RRF score
function usageBonus(note: ParsedNote): number {
  const count = note.frontmatter.access_count ?? 0;
  return Math.log(count + 1) * 0.05; // log scale
}
```

### Implementation Location

| File | Change |
|:--|:--|
| `tag-indexer.ts` | Add parsing of `access_count`, `last_accessed` in frontmatter |
| `hybrid-search.ts` | Add `usageBonus` in `fuseResults()` |
| `context-provider.ts` | Call `recordAccess()` when returning search results |

---

## Proposal 9: Adaptive Exponential Decay — FadeMem Pattern

> **Difficulty**: 🟡 Medium | **Dependencies**: None | **Impact**: Search precision + storage savings
> **Reference**: FadeMem (arXiv:2601.18642, 2026.01) — based on the Ebbinghaus forgetting curve

### Principle

Assign a **strength** to every memory, which decays exponentially over time.

```
strength(t) = e^(-λ × Δt) × frequencyBoost

λ = base decay constant (determined by tag)
Δt = (current time - last access time) / 1 day
frequencyBoost = 1 + ln(accessCount + 1) / 10
```

### Per-Tag Decay Rates

```
┌──────────────────────────────────────────────────────┐
│  strength                                            │
│  1.0 ┤ ●                                             │
│      │  ╲  sop (λ=0.01, half-life 69 days)            │
│  0.8 ┤   ╲                                           │
│      │    ╲╲  reference (λ=0.03, half-life 23 days)   │
│  0.6 ┤     ╲ ╲                                       │
│      │      ╲  ╲╲  episodic (λ=0.07, half-life 10d)  │
│  0.4 ┤       ╲   ╲╲                                  │
│      │        ╲    ╲╲╲                               │
│  0.2 ┤ --------╲-----╲╲----- compaction threshold(0.2)│
│      │          ╲      ╲╲╲                           │
│  0.0 ┤───────────╲───────╲╲──── archive threshold(0.05)│
│      └─────┬─────┬─────┬─────┬─────── days elapsed   │
│            10    20    30    60                       │
└──────────────────────────────────────────────────────┘
```

```typescript
// retrieval-weights.ts — per-tag decay constants
const DECAY_RATES: Record<string, number> = {
  sop:       0.01,  // half-life 69 days
  playbook:  0.02,  // half-life 35 days
  reference: 0.03,  // half-life 23 days
  episodic:  0.07,  // half-life 10 days
  scratch:   0.15,  // half-life 5 days
};

function decayRate(tags: string[]): number {
  for (const tag of tags) {
    if (tag in DECAY_RATES) return DECAY_RATES[tag];
  }
  return 0.03; // default: reference level
}

// hybrid-search.ts — apply decay to the search score
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

### Automatic Action on Reaching Thresholds

```
strength > 0.2  → normal (included in search results)
strength ≤ 0.2  → compaction target (summarize → distill into a fact note)
strength ≤ 0.05 → archive target (move to archives/)
```

### FadeMem Benchmark Reference Results

- **45% reduction** in storage
- Maintains multi-hop reasoning accuracy (LoCoMo benchmark)

---

## Proposal 10: Tiered Consolidation Pipeline (Tiered Consolidation)

> **Difficulty**: 🟡 Medium | **Dependencies**: None | **Impact**: Complete overhaul of storage structure
> **Reference**: Tiering patterns of long-term memory systems such as Letta/Mem0 (based on 2025–2026 public material)

### Current vs. Proposed

```
Current:
  Scratchpad (max 64 entries) ──────────────── vault-retention focused
  ← No Warm/Cold summary tier between working memory and the long-term vault

Proposed:
  ┌────────────────────────────────────────────────────────────┐
  │ Tier 1: Working Memory (Scratchpad)                       │
  │ TTL: expires at session end                               │
  │ Form: LRU register (retained as-is)                        │
  ├────────────────────────────────────────────────────────────┤
  │ Tier 2: Episodic Memory                                    │
  │ TTL: 7–30 days (strength-based decay)                      │
  │ Form: per-mission execution log                            │
  │ After decay: → LLM distillation → Tier 3                  │
  ├────────────────────────────────────────────────────────────┤
  │ Tier 3: Semantic Memory                                    │
  │ TTL: indefinite (updated only on conflict)                 │
  │ Form: distilled facts/preferences/rules                    │
  ├────────────────────────────────────────────────────────────┤
  │ Tier 4: Archive                                            │
  │ Form: compressed original preservation                     │
  │ Role: audit trail, restore when needed                     │
  └────────────────────────────────────────────────────────────┘
```

### Compaction Pipeline

```typescript
// memory-consolidation.ts — new method
async function compact(notes: ParsedNote[]): Promise<CompactionResult> {
  const result: CompactionResult = { promoted: [], archived: [], distilled: [] };
  
  for (const note of notes) {
    const strength = memoryStrength(note);
    const tier = note.frontmatter.tier ?? 'episodic';
    
    if (tier === 'episodic' && strength <= 0.05) {
      // Tier 2 → Tier 4: archive
      await moveToArchive(note);
      result.archived.push(note.path);
    } else if (tier === 'episodic' && strength <= 0.2) {
      // Tier 2 → Tier 3: LLM distillation
      const fact = await distillToFact(note); // LLM summary
      await saveFact(fact);
      await moveToArchive(note);
      result.distilled.push(note.path);
    }
  }
  return result;
}
```

### Implementation Location

| File | Change |
|:--|:--|
| `tag-indexer.ts` | Parse `tier` field in frontmatter |
| `memory-consolidation.ts` | Add `compact()` method |
| `hybrid-search.ts` | Search only Tier 1-3, exclude Tier 4 |
| `context-provider.ts` | Trigger compaction at initialization |

---

## Proposal 11: Conflict-Driven Forgetting (Conflict-Driven Forgetting)

> **Difficulty**: 🟠 Medium–High | **Dependencies**: None | **Impact**: Fact accuracy

### Problem

```
Existing note: "In Node.js 18, fetch is experimental"
New info:      "In Node.js 22, fetch is stable"

Current: both stored → the older version may surface first in search
```

### Proposal

```typescript
// memory-consolidation.ts — conflict check when storing a new note
async function conflictCheck(
  newNote: ParsedNote, 
  existingNotes: ParsedNote[],
  search: HybridSearch
): Promise<ConflictResolution> {
  // 1. Extract the top 5 most similar existing notes
  const candidates = search.search(newNote.content, 'worker', 5);
  
  for (const hit of candidates) {
    if (hit.score < 0.6) continue; // irrelevant
    
    // 2. Same tags + high similarity → conflict candidate
    const tagOverlap = intersect(newNote.tags, hit.tags).length;
    if (tagOverlap === 0) continue;
    
    // 3. Decision
    if (isSuperseding(newNote, hit)) {
      await moveToArchive(hit.note);  // archive the old note
      inheritLinks(newNote, hit.note); // inherit links
      return { action: 'replaced', old: hit.path };
    }
  }
  return { action: 'none' };
}
```

---

## Proposal 12: A-Mem Autonomous Linking — Agent-Driven Graph Growth

> **Difficulty**: 🔴 High | **Dependencies**: None | **Impact**: Graph quality
> **Reference**: A-Mem (NeurIPS 2025) — Zettelkasten-based autonomous memory

### Current State

A wikilink `[[target]]` is created only when **a human writes it directly**. Even when an agent creates a note, it becomes an orphan if no links are attached.

### Proposal

When storing a note, the agent **automatically finds related notes and creates bidirectional links**.

```typescript
// graph-parser.ts — new method
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

// Automatically insert links after storing
async function autoLink(note: ParsedNote): Promise<void> {
  const suggestions = suggestLinks(note, allNotes, hybridSearch);
  
  // Add links to the new note
  const linkSection = suggestions
    .map(s => `- ${s.wikiLink}`)
    .join('\n');
  note.content += `\n\n## Related Notes\n${linkSection}\n`;
  
  // Add reverse links to the target notes
  for (const s of suggestions) {
    await appendBacklink(s.target, note.path);
  }
}
```

### A-Mem Core Principles

```
1. Atomicity: every memory is independent and self-contained
2. Connectivity: similar memories are automatically connected
3. Evolvability: new information updates the context of existing memories
4. Autonomy: the agent manages the graph without human intervention
```

---

## Memory Decay Priority Matrix

| Order | Proposal | Impact | Difficulty | Dependencies | Prerequisites |
|:----:|:-----|:------:|:------:|:------:|:---------|
| **1** | ⑧ Access frequency tracking | ⭐⭐⭐ | 🟢 Low | None | None |
| **2** | ⑨ Adaptive exponential decay | ⭐⭐⭐⭐ | 🟡 Medium | None | Proposal 8 |
| **3** | ⑩ Tiered consolidation | ⭐⭐⭐⭐⭐ | 🟡 Medium | None | Proposals 8, 9 |
| **4** | ⑪ Conflict-driven forgetting | ⭐⭐⭐ | 🟠 Medium–High | None | None |
| **5** | ⑫ A-Mem autonomous linking | ⭐⭐⭐⭐ | 🔴 High | None | Proposal 8 |
| **6** | ⑬ Local Ebbinghaus memory OS | ⭐⭐⭐⭐⭐ | 🟠 Medium–High | None | Proposals 8, 9, 11 |

## Memory Decay Implementation Roadmap

```
Phase A (1-2 wk):  Proposal 8 — frontmatter extension + access counter
Phase B (2-4 wk):  Proposal 9 — decay function + RRF score reflection
Phase C (4-8 wk):  Proposal 10 — 4-Tier structure + compaction pipeline
Phase D (8 wk+):   Proposals 11, 12 — conflict detection + autonomous linking
Phase E (8-12 wk): Proposal 13 — local memory OS + long-term evaluation harness
```

---

# Part 3: Local Ebbinghaus-Based Memory OS Proposal

> **Goal**: Build long-term agent memory using only a Markdown vault + local index, without any external API. The key is not "store everything" but creating **memories with strength** and reinforcing, compacting, replacing, and archiving them based on retrieval, usage, conflict, and the passage of time.

## Recent Research Basis

| Research | Key Finding | Local Design Reflection |
|:--|:--|:--|
| [FadeMem, arXiv:2601.18642](https://arxiv.org/abs/2601.18642) | Ebbinghaus-based adaptive exponential decay reflecting access frequency/semantic relevance/temporal pattern, reports 45% storage reduction | Store `strength`, `access_count`, `last_accessed`, `decay_lambda` in frontmatter and multiply them into the search score |
| [FSFM, arXiv:2604.20300](https://arxiv.org/abs/2604.20300) | Classifies passive decay, active deletion, safety-triggered, adaptive reinforcement | Separate decay into a policy engine rather than a single cron job |
| [Zep/Graphiti, arXiv:2501.13956](https://arxiv.org/abs/2501.13956) | Time-aware knowledge graph that maintains historical relationships | Keep `event_time`, `ingestion_time`, `valid_from`, `valid_to`, `supersedes` as note metadata |
| [Mem0, arXiv:2504.19413](https://arxiv.org/abs/2504.19413) | Extracts, consolidates, and retrieves salient information from conversations and provides a graph memory variant | Extract at the fact/event/preference granularity instead of piling up raw logs |
| [LiCoMemory, arXiv:2511.01448](https://arxiv.org/abs/2511.01448) | Hierarchical graph + temporal/hierarchy-aware search | Use the tag/link graph for layer-aware reranking |
| [LongMemEval-V2, arXiv:2605.12493](https://arxiv.org/abs/2605.12493) | Decomposes long-term memory evaluation for web agents into static state, dynamic state, workflow, gotchas, premise awareness | Define the completion criterion as environment-experience query accuracy rather than "stored" |

## Proposal 13: Local Ebbinghaus Memory OS

### Memory Record Format

```yaml
---
tags: [memory, sop]
memory_id: mem_20260619_001
memory_kind: sop              # sop | fact | preference | episode | gotcha | workflow
memory_layer: warm            # hot | warm | cold | archive
event_time: 2026-06-18T00:00:00Z       # when the fact became true in the world
ingestion_time: 2026-06-19T09:00:00Z   # when the agent learned this fact
record_updated_at: 2026-06-19T09:00:00Z
last_accessed: 2026-06-19T09:00:00Z
access_count: 3
access_ema: 1.42              # exponential moving average that weighs recent access more
importance: 0.82              # importance based on agent/role/task
confidence: 0.91              # extraction confidence
decay_lambda: 0.02
strength: 0.78
valid_from: 2026-06-19T00:00:00Z
valid_to: null
supersedes: []
source_hash: sha256:...
keep: false
---
```

### Bi-temporal Time Model

| Field | Meaning | Usage Location |
|:--|:--|:--|
| `event_time` | When the fact/event actually occurred or became true in the real world | "Was it true at that time?" queries, temporal conflict, default for `valid_from` |
| `ingestion_time` | When the agent observed/learned/stored that fact | Decay fallback, source recency, reproducible audit trail |
| `valid_from` / `valid_to` | The interval during which the fact is valid | Judging stale CVEs, expired IOCs, replaced credentials |
| `last_accessed` | The last time it was used as a search result | Ebbinghaus reinforcement/decay calculation |

If you keep only a single timestamp, "when the fact was true" and "when the agent learned it" get conflated. The local memory layer must separate these two so it can make judgments like `CVE-2024-1234 was dangerous on 2024-03-15 but is now low priority after the 2024-04-01 patch`.

### Decay Function

```typescript
type MemoryMeta = {
  memory_kind?: string;
  memory_layer?: 'hot' | 'warm' | 'cold' | 'archive';
  event_time?: string;
  ingestion_time?: string;
  last_accessed?: string;
  access_count?: number;
  access_ema?: number;
  importance?: number;
  confidence?: number;
  decay_lambda?: number;
  keep?: boolean;
};

const KIND_DECAY: Record<string, number> = {
  sop: 0.006,       // procedures decay slowly
  workflow: 0.010,
  fact: 0.018,
  preference: 0.020,
  gotcha: 0.030,
  episode: 0.070,
};

function memoryStrength(meta: MemoryMeta, now = Date.now()): number {
  if (meta.keep) return 1.0;

  const last = Date.parse(meta.last_accessed ?? meta.ingestion_time ?? new Date(now).toISOString());
  const ageDays = Math.max(0, (now - last) / 86_400_000);
  const lambda = meta.decay_lambda ?? KIND_DECAY[meta.memory_kind ?? 'fact'] ?? 0.03;
  const access = meta.access_ema ?? meta.access_count ?? 0;
  const reinforcement = 1 + Math.log1p(access) / 4;
  const quality = Math.max(0.1, (meta.importance ?? 0.5) * (meta.confidence ?? 0.8));

  return Math.max(0.03, Math.min(1.0, quality * reinforcement * Math.exp(-lambda * ageDays)));
}
```

### Local Pipeline

```
Write path:
  session/event/raw note
    → salient fact extraction
    → store event_time and ingestion_time separately
    → duplicate/source_hash check
    → temporal conflict check
    → memory_kind/layer assignment
    → markdown note + graph index update

Read path:
  query
    → lexical + semantic + graph candidates
    → strength calculation
    → fuse with role/context weight
    → reinforce returned notes via recordAccess()

Maintenance path:
  daily or N writes
    → recompute strength
    → move hot↔warm↔cold
    → generate cold summaries
    → archive or tombstone obsolete/sensitive/malicious notes
```

### Implementation Units

| Step | File | Change |
|:--|:--|:--|
| Metadata extension | `tag-indexer.ts` | Parse `memory_*`, `event_time`, `ingestion_time`, `access_ema`, `valid_*`, `supersedes` frontmatter |
| Primary strength calculation | `hybrid-search.ts` | Place `memoryStrength()` and per-kind lambda near search and multiply into the fused score |
| Search integration | `context-provider.ts`, `hybrid-search.ts` | Pass frontmatter to `HybridSearch.indexContent()` and exclude the archive layer |
| Generated memory | `mission-memory.ts` | Record `event_time`, `ingestion_time`, `record_updated_at`, `last_accessed`, `memory_kind`, `memory_layer` in mission memory frontmatter |
| Access reinforcement | `context-provider.ts` or a separate writer | Call `recordAccess()` after returning search results. Deferred in the first implementation to avoid surprise disk writes |
| Conflict/replacement | `memory-lifecycle.ts` (new) | Handle `valid_to`, `supersedes`, tombstones |
| Evaluation | `tests/knowledge-memory-decay.test.ts` | Measure recall/latency/storage with LongMemEval-V2-style local fixtures |

### 2026-06-19 Implementation Update

The first-pass scope is focused on the safe read path. It parses and generates `event_time` and `ingestion_time`, and applies the Ebbinghaus-style decay multiplier only to notes that have explicit memory metadata. Existing documents without metadata keep a neutral multiplier of `1.0`, so search results for ordinary documents retain the existing ranking policy.

The decay formula has been consolidated into a single source (`memory-scoring.ts`), so that `hybrid-search.ts` (search ranking) and `memory-lifecycle.ts` (maintenance) share the same `memoryStrength()`, `KIND_DECAY`, and constants. The shipped constants are: strength clamp lower bound `0.05`, quality defaults `importance=1.0 · confidence=1.0` (lower bound `0.1`), expiration (`valid_to`) multiplier `0.35`, `keep=true → 1.0`, and archive layer `→ 0`.

Items previously marked as "deferred" were in fact implemented, but **do not run automatically**:

- `recordAccess()`'s persistent writes (updating access count/EMA/`last_accessed` frontmatter) are **implemented but OFF by default and opt-in**. To prevent surprise disk mutation during search, they are activated only via the `KnowledgeContextProvider` constructor flag (`enableAccessWriteback`) or the environment variable `OPENCODE_MEMORY_WRITEBACK` (truthy = `"1"`/`"true"`). The default search path makes no disk changes.
- hot/warm/cold physical movement (tier move/archive) and tombstone-based temporal supersession are **implemented but manual/opt-in**. They run only through the single entry point `runMemoryMaintenance()` (exported from `src/core/knowledge/index.ts`), and the **default is `dryRun: true`**, which returns only a plan without moving files. Destructive moves are performed only when `dryRun: false` is explicitly passed, and they are never invoked from any search/index path (gate via `OPENCODE_MEMORY_MAINTENANCE` if needed).

### Local Evaluation Gates

| Gate | Criterion |
|:--|:--|
| Recall | No MRR@10 regression vs. baseline on static state, workflow, and gotcha queries |
| Temporal | Past facts (by `event_time`) and learning time (by `ingestion_time`) are separated, newer information is retrieved before older information, and older information is explainable via `valid_to` |
| Storage | At least 30% reduction in active-layer token count vs. raw memory |
| Latency | Search p95 does not degrade by more than 20% vs. baseline |
| Safety | `privacy_class=sensitive` or malicious markers are not included in the search prompt |
| Recoverability | Archived/tombstoned notes have a manual recovery path |

### Key Judgment

A local-based Ebbinghaus memory is feasible. However, simply deleting old notes by `last_accessed` is dangerous. A safe implementation is a structure that **reduces search exposure via decay scores, and performs compaction/archiving only after a separate dry-run and tombstoning**. This way, the accuracy, cost, and security of long-term memory can be managed together without an external vector DB or cloud memory service.

---

*Authored by: AI Agent · 2026-06-19 · opencode-orchestrator search system enhancement proposal (Part 1: search enhancement Proposals 1–7, Part 2: memory decay Proposals 8–12, Part 3: local Ebbinghaus memory OS Proposal 13)*
