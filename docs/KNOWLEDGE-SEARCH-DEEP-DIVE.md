# Knowledge Store & Search System — Technical Deep Dive

> **Target audience**: Developers and researchers who want to understand opencode-orchestrator's search pipeline
> **Last updated**: 2026-06-19
> **Source path**: `src/core/knowledge/`

---

## Table of Contents

1. [The Whole Picture at a Glance](#1-the-whole-picture-at-a-glance)
2. [Markdown Parsing and Indexing](#2-markdown-parsing-and-indexing)
3. [Tag System](#3-tag-system)
4. [Wikilink Graph](#4-wikilink-graph)
5. [BM25 Keyword Search](#5-bm25-keyword-search)
6. [Tag Search](#6-tag-search)
7. [Graph Search — 2-hop BFS](#7-graph-search--2-hop-bfs)
8. [RRF Hybrid Fusion](#8-rrf-hybrid-fusion)
9. [Per-Role Search Weights](#9-per-role-search-weights)
10. [Memory Horizon](#10-memory-horizon)
11. [Comparison with Neural Embeddings](#11-comparison-with-neural-embeddings)
12. [Limitations and Future Enhancements](#12-limitations-and-future-enhancements)

---

## 1. The Whole Picture at a Glance

The ASCII diagram below shows the full flow from a markdown file to a search result.

```
                          ┌──────────────────┐
                          │  .md file intake  │
                          │ (docs/ directory) │
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
     │   (BM25)     │  │ (tag match)  │  │ (2-hop BFS) │
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
                   │  (top N returned) │
                   └──────────────────┘
```

**Dependencies between the core modules:**

```
context-provider.ts ─── orchestrates ───→ TagIndexer
        │                                  GraphParser
        │                                  HybridSearch
        │                                  weightsForRole()
        │
        └──→ buildPrompt() → <knowledge_rag_context> XML block
```

**File layout:**

| File | Role | Lines |
|:---|:---|---:|
| `context-provider.ts` | Orchestrates file intake → indexing → search → prompt generation | 130 |
| `tag-indexer.ts` | YAML frontmatter parsing, tag inverted index | 208 |
| `graph-parser.ts` | Wikilink/markdown link parsing, bidirectional graph construction | 153 |
| `hybrid-search.ts` | BM25 + tag + graph search, RRF fusion | 233 |
| `retrieval-weights.ts` | Per-role weights, memory horizon | 59 |
| `memory-consolidation.ts` | Graph maintenance (oversized/orphan/merge detection) | 148 |
| `mission-memory.ts` | Syncs mission-loop state to markdown notes | 276 |
| `safety-guards.ts` | Circular-link detection, concurrent-write queue, pin checks | 102 |
| `scratchpad.ts` | LRU-based volatile register cache | 109 |
| `index.ts` | Barrel file (barrel export) | 22 |

---

## 2. Markdown Parsing and Indexing

### 2.1 File Intake

`KnowledgeContextProvider.collectMarkdownFiles()`
([context-provider.ts:36–46](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/context-provider.ts#L36-L46))
recursively collects `.md` files from **two** roots within the project directory.

```typescript
const KNOWLEDGE_ROOTS = ["docs", path.join(".opencode", "docs")];
const SKIP_SEGMENTS = new Set(["node_modules", "dist", "bin", ".git", "archive"]);
```

- `docs/` — user documentation
- `.opencode/docs/` — orchestrator auto-generated documentation

`walkDirectory()` ([context-provider.ts:48–63](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/context-provider.ts#L48-L63)) skips directories that belong to `SKIP_SEGMENTS`. It also uses `isDirectInjectedScratchpad()` to exclude the auto-generated scratchpad file (`.opencode/docs/brain/scratchpad.md`) in order to **prevent duplicate injection**.

### 2.2 Indexing Pipeline

`indexKnowledge()` ([context-provider.ts:65–90](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/context-provider.ts#L65-L90)) performs **three stages** of indexing for each collected file:

```
read file → parseFrontmatter() → split frontmatter/body
                                      │
           ┌──────────────────────────┤
           ▼                          ▼                    ▼
  tagIndexer.indexFile()    graphParser.indexFile()   search.indexContent()
  (update tag inverted index) (update link graph)      (store body text)
```

1. **Frontmatter split**: `TagIndexer.parseFrontmatter(content)` → `{ data, body }`
2. **Tag indexing**: `tagIndexer.indexFile(filePath, content)` → tag→file inverted index
3. **Graph indexing**: `graphParser.indexFile(filePath, content)` → bidirectional link map
4. **Body registration**: `search.indexContent(noteName, normalizedBody)` → stored lowercased in `contentMap`

**Note-name rule**: The note name is the file path's basename with its extension stripped. For example: `/docs/architecture.md` → `architecture`

```typescript
// graph-parser.ts:21-25
public getNoteName(filePath: string): string {
    const basename = filePath.split(/[/\\]/).pop() || "";
    const dotIdx = basename.lastIndexOf(".");
    return dotIdx !== -1 ? basename.slice(0, dotIdx) : basename;
}
```

### 2.3 Snippet Generation

Each note's body is condensed by `buildSnippet()` ([context-provider.ts:92–96](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/context-provider.ts#L92-L96)) into a snippet of at most 220 characters that is included in the search result.

```typescript
const MAX_SNIPPET_CHARS = 220;

private buildSnippet(content: string): string {
    const normalized = content.replace(/\s+/g, " ").trim();
    if (normalized.length <= MAX_SNIPPET_CHARS) return normalized;
    return `${normalized.slice(0, MAX_SNIPPET_CHARS)}...`;
}
```

---

## 3. Tag System

### 3.1 Frontmatter Parsing

`TagIndexer.parseFrontmatter()` ([tag-indexer.ts:24–43](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/tag-indexer.ts#L24-L43)) is a **regex-based** lightweight YAML parser. It provides deterministic error recovery without any external library dependency.

```
Input markdown:
  ---
  tags: [architecture, search]
  title: "Knowledge Search"
  keep: true
  ---
  # Body begins...

Parse result:
  data = { tags: ["architecture", "search"], title: "Knowledge Search", keep: true }
  body = "# Body begins..."
```

**Parsing logic:**

1. Extract the frontmatter block with the regex `^---\r?\n([\s\S]*?)\r?\n---`
2. Call `parseYamlLine()` for each line:
   - `key: [val1, val2]` → parsed as an inline array
   - `key: value` → type inferred via `parseScalar()` (`true`/`false` → boolean, numbers → number)
   - `key:` (no value) → initialize an empty array, appended from subsequent `- item` lines
   - `- item` → appended to the array of the currently active key

### 3.2 Tag Inverted Index

`tagMap` is a `Map<string, Set<string>>` structure: an inverted index of **tag → set of file paths**.

```
tagMap:
  "architecture" → { "/docs/arch.md", "/docs/design.md" }
  "search"       → { "/docs/search.md", "/docs/hybrid.md" }
  "mission"      → { ".opencode/docs/brain/scratchpad.md" }
```

**Indexing process** ([tag-indexer.ts:82–95](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/tag-indexer.ts#L82-L95)):

1. `clearIndexForFile(filePath)` — remove existing mappings (prevents duplication on re-indexing)
2. `parseFrontmatter(content)` — extract the `tags` array from frontmatter
3. Normalize each tag to lowercase and call `addTagEntry(tag, filePath)`

### 3.3 Lookup API

| Method | Time complexity | Description |
|:---|:---:|:---|
| `getFilesWithTag(tag)` | O(1) | Returns the set of files matching a single tag |
| `getFilesWithAllTags(tags)` | O(n·k) | Files that have **all** tags simultaneously (intersection) |
| `getFilesWithAnyTags(tags)` | O(n·k) | Files that have one or more of the tags (union) |
| `getAllTags()` | O(1) | The complete list of tags |
| `getMetadata(filePath)` | O(1) | Returns the cached frontmatter |

**Design intent**: Using a `Map` + `Set` structure guarantees O(1) lookups, and on re-indexing `clearIndexForFile` cleans up existing entries **atomically**. Empty Sets are deleted immediately to prevent memory leaks.

---

## 4. Wikilink Graph

### 4.1 Link Extraction

`GraphParser.parseLinks()` ([graph-parser.ts:30–57](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/graph-parser.ts#L30-L57)) parses two link formats:

**① Wikilinks (Obsidian style)**

```
Regex: /\[\[([^\[\]|#]+)(?:\|[^\[\]]+)?(?:#[^\[\]]+)?\]\]/g
```

| Example | Capture result |
|:---|:---|
| `[[Architecture]]` | `Architecture` |
| `[[Architecture\|Architecture KR]]` | `Architecture` (label ignored) |
| `[[Architecture#search]]` | `Architecture` (section anchor ignored) |

- `[^\[\]|#]+` — captures the note name, excluding brackets, pipes, and hashes
- `(?:\|[^\[\]]+)?` — optional display label (non-capturing group)
- `(?:#[^\[\]]+)?` — optional section anchor (non-capturing group)

**② Standard markdown links**

```
Regex: /\[([^\]]+)\]\(([^)]+)\)/g
```

Filter that extracts only local files:

```typescript
// graph-parser.ts:48
if (!url.includes("://") && (url.endsWith(".md") || url.startsWith(".") || url.startsWith("/")))
```

- If it contains `://`, it is treated as an external URL and excluded
- Only the `.md` extension, a leading `.` (relative path), or a leading `/` (absolute path) are recognized as local references

### 4.2 Bidirectional Graph Structure

`GraphParser` manages the graph with four `Map`s:

```
forwardLinks:  noteA → { noteB, noteC }      "A references B and C"
backlinks:     noteB → { noteA }              "B is referenced by A"
               noteC → { noteA }

noteToPath:    noteA → "/docs/noteA.md"
pathToNote:    "/docs/noteA.md" → noteA
```

### 4.3 Indexing Flow

`indexFile()` ([graph-parser.ts:62–86](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/graph-parser.ts#L62-L86)):

```
1. getNoteName(filePath) → sourceNote
2. clearIndexForNote(sourceNote)     ← clean up existing forward→backlink pairs
3. parseLinks(content) → targets[]
4. forwardLinks.set(sourceNote, new Set(targets))
5. for each target:
   backlinks[target].add(sourceNote)
```

**The role of `clearIndexForNote()`** ([graph-parser.ts:137–151](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/graph-parser.ts#L137-L151)): When re-indexing a note, it **removes that note from the backlink sets of the targets that the previous forward links pointed to**. This guarantees the **consistency** of the link graph.

### 4.4 Backlink Synchronization

`syncBacklinksSection()` ([graph-parser.ts:113–132](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/graph-parser.ts#L113-L132)) automatically updates the `## 🔗 Backlinks` section in the note body:

```markdown
## 🔗 Backlinks

- [[Architecture]]
- [[Design-Decisions]]
```

- If an existing section is present, it is replaced via regex
- If absent, it is appended to the end of the file
- If empty, `*(No backlinks found)*` is shown

---

## 5. BM25 Keyword Search

### 5.1 Overall Flow

`lexicalSearch()` ([hybrid-search.ts:66–89](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L66-L89)) computes keyword scores based on the BM25 algorithm.

```
terms[] ──→ for each term:
            │
            ├─ documentFrequency(term) → df
            ├─ compute IDF
            │
            └─ for each document:
               ├─ countOccurrences(content, term) → tf
               ├─ TF normalization
               └─ score += IDF × tfNorm
```

### 5.2 Constants

```typescript
// hybrid-search.ts:22-24
const BM25_K1 = 1.2;   // term-frequency saturation parameter
const BM25_B = 0.75;    // document-length normalization weight
```

| Constant | Value | Meaning |
|:---|:---|:---|
| `BM25_K1` | 1.2 | Controls the slope of the TF saturation curve. Higher values favor documents with higher frequency |
| `BM25_B` | 0.75 | Document-length correction ratio. 1.0 is full normalization, 0 ignores length |

### 5.3 IDF (Inverse Document Frequency)

```
IDF(t) = ln( (N - df(t) + 0.5) / (df(t) + 0.5) + 1 )
```

```typescript
// hybrid-search.ts:75
const idf = Math.log((corpusSize - df + 0.5) / (df + 0.5) + 1);
```

- `N` = `corpusSize` (total number of documents)
- `df(t)` = number of documents containing term `t`

**Interpretation**:
- Common words that appear in every document → IDF ≈ 0 (low information content)
- Words that appear in only a few documents → high IDF (high discriminative power)
- The `+ 1` prevents IDF from becoming negative (a standard BM25 improvement)

### 5.4 TF Normalization

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

- `tf(t,d)` = number of occurrences of term `t` in document `d`
- `|d|` = `docLen` (number of characters in the document)
- `avgdl` = `avgLen` (average document length in the corpus)

**Characteristics**:
- As `tf` increases, `tfNorm` asymptotically converges to `(k1+1)` = 2.2 (saturation)
- If a document is longer than average, the denominator grows and the score drops (length penalty)
- If a document is shorter than average, the denominator shrinks and the score rises (length reward)

### 5.5 Final Score

```
score(d) = Σ IDF(t) × tfNorm(t, d)    (t ∈ query terms)
```

```typescript
// hybrid-search.ts:84
scores.set(name, prev + idf * tfNorm);
```

### 5.6 Term Frequency Counting

`countOccurrences()` ([hybrid-search.ts:198–206](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L198-L206)) counts term occurrences in text in a **non-overlapping** manner:

```typescript
private countOccurrences(text: string, term: string): number {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(term, pos)) !== -1) {
        count++;
        pos += term.length;  // advance past the match so they do not overlap
    }
    return count;
}
```

### 5.7 Document Frequency Counting

`documentFrequency()` ([hybrid-search.ts:218–224](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L218-L224)) computes the number of documents containing a term via a linear scan:

```typescript
private documentFrequency(term: string): number {
    let count = 0;
    for (const content of this.contentMap.values()) {
        if (content.includes(term)) count++;
    }
    return count;
}
```

> **Design trade-off**: Rather than building a separate inverted index, it scans the entire corpus on every query. For a project-local knowledge store with documents in the hundreds, this is fast enough; but scaling to tens of thousands or more would require an inverted index.

---

## 6. Tag Search

`tagSearch()` ([hybrid-search.ts:94–105](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L94-L105)) treats query terms as tags to find matching notes.

### 6.1 Algorithm

```
for each query term:
  tagIndexer.getFilesWithTag(term) → set of files
  for each file:
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

### 6.2 Scoring Scheme

- **Score = number of matched query terms (tags)**
- If the query is `"architecture search"` and a note has both tags → score 2
- If only one matches → score 1

### 6.3 Design Rationale

Tag search leverages **structural metadata**. Even if a keyword is absent from the body, a note can still be found as long as the appropriate tag is attached. This serves to complement BM25's lexical limitations.

---

## 7. Graph Search — 2-hop BFS

### 7.1 Overview

`graphSearch()` ([hybrid-search.ts:110–119](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L110-L119)) takes the tag-search results as **seed notes** and traverses the link graph up to 2 hops to discover related notes.

```
query → tagSearch() → seed notes
                       │
                       ▼
               ┌───────────────┐
               │ traverseGraph │
               │  depth=2      │
               └───────┬───────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   1-hop neighbor  2-hop neighbor  (stop at depth=0)
   score += 2      score += 1
```

### 7.2 Traversal Constant

```typescript
// hybrid-search.ts:26
const GRAPH_HOP_DEPTH = 2;
```

### 7.3 traverseGraph Algorithm

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
        scores.set(neighbor, prev + depth);     // ← closer means higher score
        this.traverseGraph(neighbor, depth - 1, visited, scores);
    }
}
```

**Key behavior:**

1. **Bidirectional traversal**: treats **both** forward links and backlinks as neighbors
2. **Score = remaining depth**: 1-hop neighbor → `+2`, 2-hop neighbor → `+1`
3. **Visit tracking**: prevents cycles with a `visited` Set
4. **Depth limit**: since `GRAPH_HOP_DEPTH = 2`, traversal goes at most 2 hops

### 7.4 Score Accumulation

If a single note is reachable from multiple seeds, its score accumulates:

```
seed A → note X (1-hop, +2)
seed B → note X (1-hop, +2)
────────────────────────────
note X final score = 4
```

### 7.5 Design Rationale

- **2-hop limit**: In a small knowledge graph, 3 hops or more reaches almost every note, so discriminative power vanishes
- **Depth-based scoring**: Reflects the intuition that nodes closer to a seed are more relevant
- **Tag-seed dependence**: Because it starts from tag-search results rather than running graph search alone, it suppresses diffusion into unrelated regions of the graph

---

## 8. RRF Hybrid Fusion

### 8.1 Reciprocal Rank Fusion (RRF)

`fuseResults()` ([hybrid-search.ts:149–166](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/hybrid-search.ts#L149-L166)) integrates the ranked lists of the three search engines via **Reciprocal Rank Fusion**.

### 8.2 Formula

```
RRF_score(d) = Σ w_i × 1/(k + rank_i(d))
               i ∈ {lexical, tag, graph}
```

- `k` = `RRF_K = 60` (smoothing constant, the standard value from the [original RRF paper](https://dl.acm.org/doi/10.1145/1571941.1572114))
- `rank_i(d)` = the rank of document `d` in engine `i` (0-based)
- `w_i` = per-engine weight (provided by `EngineWeights`)

### 8.3 Constants

```typescript
// hybrid-search.ts:18
const RRF_K = 60;
// hybrid-search.ts:20
const DEFAULT_MAX_RESULTS = 20;
```

### 8.4 Implementation Details

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

**matchType decision logic:**

```
rrfScore > 1/(RRF_K + 1)  →  is this higher than the score this engine yields at rank 0 (1st place)?

In effect, at rank=0:  weight × 1/(60+0+1) = weight × 1/61
Comparison threshold:  1/(60+1) = 1/61

So if an engine with weight > 1 provides the top result, the matchType is updated
```

This ensures that the **engine that contributed the most** determines that result's `matchType`.

### 8.5 Advantages of RRF

```
          score
  0.016 ┤ ■ rank 0
  0.015 ┤ ■ rank 1
  0.014 ┤ ■ rank 2
  0.013 ┤ ■ rank 3
        │   ...       ← as rank descends, the score gap shrinks sharply
  0.003 ┤             ■ rank 100
        └──────────────────────────
```

- Integrates by rank alone, **independent of each engine's raw score scale**
- Avoids the problem of directly comparing BM25's score range (0 to tens) with tag scores (integer counts)
- `k=60` properly tunes the sensitivity to top ranks (too small and only 1st place matters, too large and rank differences are ignored)

---

## 9. Per-Role Search Weights

### 9.1 EngineWeights Interface

([retrieval-weights.ts:16–20](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L16-L20))

```typescript
export interface EngineWeights {
    lexical: number;   // BM25 weight
    tag: number;       // tag-search weight
    graph: number;     // graph-search weight
}
```

### 9.2 ROLE_WEIGHTS Table

([retrieval-weights.ts:28–37](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L28-L37))

| Role | lexical | tag | graph | Design rationale |
|:---|:---:|:---:|:---:|:---|
| **planner** | 0.8 | 1.1 | **1.3** | Reasons about dependencies/architecture → prioritize graph structure |
| **worker** | **1.3** | 1.0 | 0.7 | Concrete implementation → prioritize precise keyword hits |
| **reviewer** | 1.0 | **1.2** | 1.0 | Needs breadth of evidence → prioritize tag/topic coverage |
| **commander** | 1.0 | 1.0 | 1.0 | Coordination role → neutral |

Visually:

```
             lexical    tag    graph
  planner:    ████░      █████░     ███████░   ← graph emphasized
  worker:     ███████░   █████░     ████░      ← keyword emphasized
  reviewer:   █████░     ██████░    █████░     ← tag emphasized
  commander:  █████░     █████░     █████░     ← even
```

### 9.3 weightsForRole()

([retrieval-weights.ts:39–42](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L39-L42))

```typescript
export function weightsForRole(role?: string | null): EngineWeights {
    if (!role) return NEUTRAL_WEIGHTS;
    return ROLE_WEIGHTS[role.toLowerCase()] ?? NEUTRAL_WEIGHTS;
}
```

- If the role is `null`/`undefined`, returns the neutral weights `{ 1, 1, 1 }`
- Case-insensitive matching
- An unknown role also falls back to neutral

### 9.4 The Effect of Weights

In the RRF formula, weights are applied as a **multiplicative factor**:

```
1st-place contribution of an engine with weight 1.3:  1.3 × 1/(60+1) ≈ 0.0213
1st-place contribution of an engine with weight 0.7:  0.7 × 1/(60+1) ≈ 0.0115
```

→ About a **1.86×** difference. At the same rank, the preferred engine's contribution is nearly doubled.

---

## 10. Memory Horizon

### 10.1 MemoryHorizon Type

([retrieval-weights.ts:45](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/retrieval-weights.ts#L45))

```typescript
export type MemoryHorizon = "strategic" | "execution" | "closure";
```

| Horizon | Meaning | Memory lifetime |
|:---|:---|:---|
| `strategic` | Valid across the entire project | Long-term (persists across sessions) |
| `execution` | Valid during the current mission's execution | Medium-term (may expire at mission end) |
| `closure` | Valid until a specific task completes | Short-term (expires at task end) |

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

**Mapping relationship:**

```
MemoryLevel          MemoryHorizon
─────────────        ─────────────
system      ───────→ strategic       (long-term, system-wide)
project     ───────→ strategic       (long-term, project-wide)
mission     ───────→ execution       (medium-term, per mission)
task        ───────→ closure         (short-term, per task)
(unknown)   ───────→ execution       (default)
```

### 10.3 Usage in Mission Memory Notes

In `mission-memory.ts`, `buildMemoryNoteContent()` ([mission-memory.ts:219–247](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/mission-memory.ts#L219-L247)) records the horizon in each memory note's frontmatter:

```yaml
---
tags: [mission-memory, orchestrator, project]
title: "project memory abc-123"
keep: true                   ← assigned only when importance ≥ 0.9 (PIN_IMPORTANCE_THRESHOLD)
level: "project"
horizon: "strategic"         ← horizonForLevel("project")
importance: 0.950
memory_kind: "semantic"      ← decayProfileForLevel(level).kind
decay_lambda: 0.006          ← decayProfileForLevel(level).lambda (explicit λ)
session: "sess-001"
recorded_at: "2026-06-19T10:30:00Z"
objective: "implement the search system"
---
```

This allows an expiration policy to be applied according to the horizon during memory consolidation.

### 10.4 Forgetting-Curve Activation Policy (Important)

A generated memory note is **not unconditionally pinned.** If `importance` is below `PIN_IMPORTANCE_THRESHOLD` (`0.9`), the `keep` line is omitted so that the note participates in the Ebbinghaus decay model. This makes the README's "fade when unused" actually apply to generated data as well.

In addition, each level records a cognitive `memory_kind` and an **explicit** `decay_lambda` via `decayProfileForLevel()` (`project→semantic/0.006`, `mission→procedural/0.02`, `task→episodic/0.07`). Thanks to the explicit `decay_lambda`, `memoryStrength()` preserves the shipped decay behavior while retrieval can still apply kind-aware role bias.

Mission completion also writes one coalesced `episodic-*` note per objective. The note captures the ledger evidence trail and increments `episode_count` / `success_count` when the same objective completes again. Opt-in memory maintenance promotes repeated episodes into `semantic-*` and `procedural-*` notes, redacting secrets, timestamps, and session identifiers before writing generalized memory. Original episodic notes are preserved.

**Disk reflection of decay is opt-in.** Tier demotion, archival, and tombstone supersession occur only through `runMemoryMaintenancePass()`, and `CleanupScheduler` runs it on a 6-hour cycle only when `OPENCODE_MEMORY_MAINTENANCE=1` (OFF by default, no physical file movement). Strength weighting at search time (`score × memoryStrength`) is always applied, so even without disk cleanup, decayed memories naturally sink toward the bottom of search results.

### 10.5 Lifecycle Preservation on Re-Sync (Important)

A mission memory note is a projection of `MemoryManager` (the volatile working set), but **the lifecycle state is owned by the note itself (long-term memory).** On re-sync, `syncMissionMemoryNotes()` reads the frontmatter of the existing note (`loadExistingNoteMetadata()`) and **preserves** the following fields:

- `ingestion_time` — stably keeps the moment first learned (the bitemporal "when did we know it")
- `last_accessed`, `access_count`, `access_ema` — preserve accumulated decay age and recall reinforcement
- `memory_layer`, `tombstone`, `valid_to`, `supersedes` — preserve the tier/supersession decisions made by maintenance

Only `content`/`importance`/`event_time`/`record_updated_at` are updated from `MemoryManager`. Without this preservation, every sync would reset `last_accessed` to now and `access_count` to 1, permanently re-initializing decay and reinforcement (no accumulation possible). The archived↔active conflict is self-correcting: when recalled, strength rises and the next maintenance pass re-promotes the tier.

### 10.6 Current Limitation — Scope of Role-Weight Injection

The per-role weights of §9 are correctly wired through to `buildPrompt(query, role)`, but **in production, knowledge injection currently happens at only one place — the commander (neutral) session** (`system-transform-handler`). Therefore, for the planner/worker/reviewer-specific weights to actually reshape search, **follow-up work to add per-role injection to subagent sessions as well** is needed. Until then, the effective role weighting on the commander path is neutral.

---

## 11. Comparison with Neural Embeddings

The current opencode-orchestrator search system is **purely statistics/structure-based**. It does not use neural embeddings.

### 11.1 What the Current System Lacks

| Component | Current state | Description |
|:---|:---:|:---|
| Dense Retrieval | ❌ absent | Vectorizes documents with a pretrained encoder (BERT, E5, etc.) for semantic-similarity search |
| Cross-Encoder reranking | ❌ absent | Encodes query-document pairs jointly for precise reranking |
| Vector DB / ANN index | ❌ absent | Approximate nearest-neighbor search with FAISS, Qdrant, etc. |
| Learned sparse representations | ❌ absent | Learned sparse vectors such as SPLADE |

### 11.2 Comparison Table

| Dimension | Current system (BM25 + Tag + Graph) | Dense Retrieval + Cross-Encoder |
|:---|:---|:---|
| **Semantic understanding** | ❌ Lexical matching only. "search" ≠ "explore" | ✅ Understands synonyms and paraphrases |
| **Cross-lingual search** | ❌ Matches only same-language tokens | ✅ Cross-lingual via multilingual models |
| **Infrastructure requirements** | ✅ Zero dependencies, only Node.js needed | ❌ Requires GPU/model serving, vector DB |
| **Latency** | ✅ Millisecond range | ⚠️ Tens to hundreds of ms (model inference) |
| **Transparency** | ✅ Scoring formulas are explicit | ⚠️ Black box (hard to interpret) |
| **Update cost** | ✅ Immediate re-indexing | ⚠️ Requires recomputing vectors |
| **Use of structural relations** | ✅ Wikilink graph traversal | ❌ Ignores inter-document links (requires separate implementation) |
| **Use of metadata** | ✅ frontmatter tags | ⚠️ Metadata filtering must be implemented separately |
| **Cold start** | ✅ Works with documents alone | ❌ Requires model download/fine-tuning |

### 11.3 Strengths of the Current Design

1. **Zero dependencies**: Works with only `node:fs`, no external models or vector DB
2. **Deterministic reproducibility**: Same input → same output, easy to debug
3. **Structure-aware**: Reflects inter-document **relationships** in search via the wikilink graph
4. **Role adaptation**: Automatically adjusts the search strategy by agent role
5. **Instant updates**: Re-indexing is immediate on file change, no vector recomputation needed

---

## 12. Limitations and Future Enhancements

### 12.1 Current Limitations

| # | Limitation | Impact | Severity |
|:---|:---|:---|:---:|
| 1 | **No semantic matching** | A "search engine" query cannot find a "discovery system" document | High |
| 2 | **No cross-lingual search** | A Korean query cannot find an English document | Medium |
| 3 | **Linear scan for DF computation** | Scans the entire corpus on every query (`O(N×T)`, N=document count, T=term count) | Low¹ |
| 4 | **Graph seeds depend on tags** | A document with no tags cannot be a seed for graph search | Medium |
| 5 | **Single tokenizer** | Uses only whitespace splitting, no morphological analysis or subword tokenization | Medium |
| 6 | **Simple snippet truncation** | Returns the first 220 characters of a document rather than the query-relevant portion | Low |

> ¹ A project-local knowledge store is usually under a few hundred entries, so it is not a problem at the current scale

### 12.2 Enhancement Roadmap

```
                Now (v1)                     Future (v2)
         ┌──────────────────┐        ┌──────────────────────┐
         │  BM25 + Tag +    │        │  BM25 + Tag + Graph  │
         │  Graph + RRF     │   →    │  + Dense + RRF       │
         │                  │        │  + Cross-Encoder     │
         │  (lexical only)  │        │  (semantic + lexical) │
         └──────────────────┘        └──────────────────────┘
```

**Step-by-step enhancement plan:**

| Stage | Added component | Expected benefit | Difficulty |
|:---|:---|:---|:---:|
| **v1.1** | Term inverted index (`Map<term, Set<doc>>`) | Makes DF computation O(1) | Low |
| **v1.2** | Query-highlighting snippets | Improves contextual understanding of search results | Low |
| **v1.3** | Morphological analyzer integration (Korean `nori`, English `stemmer`) | Improves matching against inflectional variants | Medium |
| **v2.0** | Dense Retrieval (lightweight embedding model, e.g. `gte-small`) | Synonym/paraphrase matching | High |
| **v2.1** | Multilingual model (`multilingual-e5-small`) | Korean ↔ English cross-lingual search | High |
| **v2.2** | Cross-Encoder reranking | Improves precision of the top-N results | High |
| **v2.3** | Label-weighted RRF | Learn engine weights from search-quality feedback | High |

### 12.3 Proposed Architecture When Integrating Dense Retrieval

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
         │  │ denseSearch  │ ◄───┤  (NEW: 4th engine)    │
         │  │ (vector sim) │     │                       │
         │  └──────┬───────┘     │                       │
         │         │             │                       │
         └─────────┼─────────────┼───────────────────────┘
                   ▼
          ┌──────────────────┐
          │   fuseResults    │
          │  RRF (k=60)     │
          │  × EngineWeights │  ← add a `dense` field to EngineWeights
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │ Cross-Encoder    │  (optional reranking)
          │ recompute scores │
          │ for top 10 only  │
          └────────┬─────────┘
                   ▼
          ┌──────────────────┐
          │  SearchResult[]  │
          └──────────────────┘
```

**Core design principle**: Preserve the existing RRF pipeline while adding the Dense engine as a **4th ranked list**. Just adding a `dense` field to `EngineWeights` integrates it naturally with the existing per-role weight system.

---

## Appendix: Auxiliary Modules

### A. MemoryConsolidation

([memory-consolidation.ts](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/memory-consolidation.ts))

Pure analysis functions for graph **maintenance** (no side effects):

| Method | Function |
|:---|:---|
| `identifyOversizedNotes(contentMap, maxLines?)` | Detects notes exceeding 500 lines (default) → split candidates |
| `identifyOrphanNotes(allNotes)` | Detects orphan notes with both forward links and backlinks at 0 |
| `suggestMerges(threshold?)` | Note pairs sharing 3 (default) or more tags → merge candidates |
| `generateMOC(tag)` | Generates a Map of Content markdown for a specific tag |

### B. SafetyGuards

([safety-guards.ts](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/safety-guards.ts))

| Function | Method | Description |
|:---|:---|:---|
| Circular-link detection | `checkCircularLinks(graph, startNote, maxDepth?)` | Detects cycles back to the node itself via depth-limited DFS |
| Concurrent-write protection | `createWriteQueue()` | Serializes file writes with a FIFO async queue |
| Pinned-note check | `isPinned(metadata)` | `keep: true` frontmatter → excluded from cleanup |

### C. Scratchpad

([scratchpad.ts](file:///mnt/c/workspace/opencode-orchestrator/src/core/knowledge/scratchpad.ts))

| Property | Value |
|:---|:---|
| Max entries | 64 |
| Max size per entry | 4,096 bytes |
| Eviction policy | LRU (leverages Map insertion order) |
| Serialization format | Markdown (`# Scratchpad Registers` + `## key` blocks) |

---

> **This document was written based on the source code in the `src/core/knowledge/` directory.**
> **Whenever the source code and this document disagree, always trust the source code.**
