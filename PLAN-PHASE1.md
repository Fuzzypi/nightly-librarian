# The Nightly Librarian — Phase 1 Implementation Plan

**Version**: 1.0.0
**Date**: 2026-05-09
**Status**: Draft — awaiting approval
**Parent**: SPEC.md v0.1.0
**Session**: AOS-147

---

## 0. Scope

Phase 1 builds the smallest standalone pipeline that can:

1. Load a source registry from a config file
2. Fetch from a controlled set of low-noise sources
3. Normalize raw items into typed CandidateSignal records
4. Score each candidate on worthMentioning and soloDevRelevance
5. Deduplicate across sources
6. Generate a private memo (full operator context)
7. Generate a public brief (reader-facing, editorially gated)
8. Run deterministic verify gates against the public brief
9. Archive the complete run (candidates, scores, drafts, gate results)
10. Stop before publishing unless manually approved

Phase 1 does NOT publish, does NOT require Second Brain, does NOT require Claude Code at runtime, does NOT add social scraping, and does NOT build a CMS.

---

## 1. Folder Structure

```
nightly-librarian/
├── SPEC.md                        # Product spec (exists)
├── PLAN-PHASE1.md                 # This document
├── VERIFY-CHECKLIST.md            # Human checklist (exists)
├── SKILL.md                       # Internal brain job (unrelated, exists)
├── package.json
├── tsconfig.json
├── bunfig.toml
│
├── src/
│   ├── index.ts                   # CLI entry point
│   ├── types.ts                   # All shared TypeScript types
│   ├── config.ts                  # Config loader (sources, scoring, editorial)
│   │
│   ├── pipeline/
│   │   ├── fetch.ts               # Stage 1: fetch raw items from sources
│   │   ├── extract.ts             # Stage 2: parse raw → RawItem[]
│   │   ├── normalize.ts           # Stage 3: RawItem[] → CandidateSignal[]
│   │   ├── dedup.ts               # Stage 4: deduplicate candidates
│   │   ├── score.ts               # Stage 5: score each candidate
│   │   ├── select.ts              # Stage 6: pick signals for memo + brief
│   │   ├── memo.ts                # Stage 7a: generate private memo
│   │   ├── brief.ts               # Stage 7b: generate public brief
│   │   ├── verify.ts              # Stage 8: run verify gates
│   │   └── archive.ts             # Stage 9: write run artifacts
│   │
│   ├── fetchers/
│   │   ├── interface.ts           # Fetcher interface
│   │   ├── rss.ts                 # Generic RSS/Atom fetcher
│   │   ├── hackernews.ts          # HN API fetcher
│   │   ├── github-releases.ts    # GitHub releases API fetcher
│   │   └── webpage.ts             # Static webpage changelog scraper
│   │
│   ├── gates/
│   │   ├── index.ts               # Gate runner (runs all, collects results)
│   │   ├── source-ref.ts          # VG-SOURCE
│   │   ├── worth-mentioning.ts    # VG-WORTH
│   │   ├── solo-dev-relevance.ts  # VG-RELEVANCE
│   │   ├── evidence-level.ts      # VG-EVIDENCE
│   │   ├── sponsor-position.ts    # VG-SPONSOR-POS
│   │   ├── sponsor-explain.ts     # VG-SPONSOR-EXPLAIN
│   │   ├── affiliate-language.ts  # VG-AFFILIATE
│   │   ├── try-next-framing.ts    # VG-TRY-NEXT
│   │   ├── superlatives.ts        # VG-SUPERLATIVE
│   │   ├── hype-language.ts       # VG-HYPE
│   │   ├── culture-war.ts         # VG-CULTURE
│   │   ├── partisan.ts            # VG-PARTISAN
│   │   ├── moral-panic.ts         # VG-PANIC
│   │   ├── vendor-cheering.ts     # VG-VENDOR
│   │   ├── dedup-public.ts        # VG-DEDUP
│   │   ├── stale-check.ts         # VG-STALE
│   │   └── no-ignore-pile.ts      # VG-NO-IGNORE
│   │
│   └── util/
│       ├── hash.ts                # Deterministic content hashing
│       ├── date.ts                # Date/time helpers (28h window, freshness)
│       ├── text.ts                # Word count, reading level, keyword scanning
│       └── logger.ts              # Structured JSON logger
│
├── config/
│   ├── sources.json               # Source registry
│   ├── scoring.json               # Scoring weights + thresholds
│   ├── editorial.json             # Blocklists, voice rules, banned phrases
│   └── sponsors.json              # Sponsor rotation
│
├── templates/
│   ├── daily.md                   # Public brief template (exists)
│   ├── weekly.md                  # Weekly digest template (exists, Phase 2)
│   └── memo.md                    # Private memo template (new)
│
├── archive/                       # Created at runtime
│   └── runs/
│       └── YYYY-MM-DD-HHMMSS/
│           ├── run.json           # Run metadata
│           ├── raw-items.json     # All fetched raw items
│           ├── candidates.json    # Normalized + scored candidates
│           ├── selection.json     # What was selected and why
│           ├── memo.md            # Private memo output
│           ├── brief.md           # Public brief output
│           └── gates.json         # Gate results
│
└── test/
    ├── fixtures/
    │   ├── rss-sample.xml         # Sample RSS feed
    │   ├── hn-sample.json         # Sample HN API response
    │   └── candidates-scored.json # Pre-scored candidates for gate testing
    ├── fetchers/
    │   └── rss.test.ts
    ├── pipeline/
    │   ├── normalize.test.ts
    │   ├── dedup.test.ts
    │   └── score.test.ts
    └── gates/
        ├── superlatives.test.ts
        ├── sponsor-position.test.ts
        └── gate-runner.test.ts
```

---

## 2. TypeScript Types

```typescript
// src/types.ts

// ── Source Registry ──────────────────────────────────────

export type SourceTier = 1 | 2 | 3;
export type FetcherType = "rss" | "hackernews" | "github-releases" | "webpage";

export interface SourceDefinition {
  id: string;                      // "openai-changelog"
  name: string;                    // "OpenAI Changelog"
  tier: SourceTier;
  fetcherType: FetcherType;
  url: string;                     // feed URL or API endpoint
  category: SignalCategory;        // default category for items from this source
  enabled: boolean;
  fetchOptions?: Record<string, unknown>;  // fetcher-specific config
}

export interface SourceRegistry {
  sources: SourceDefinition[];
  fetchWindowHours: number;        // 28
  minTier1Sources: number;         // 3
}

// ── Signal Categories ────────────────────────────────────

export type SignalCategory =
  | "model_release"
  | "api_change"
  | "tool_release"
  | "pricing_change"
  | "security_issue"
  | "workflow_pattern"
  | "business_opportunity"
  | "deprecation"
  | "outage"
  | "benchmark";

// ── Raw Items (fetcher output) ───────────────────────────

export interface RawItem {
  sourceId: string;                // which source produced this
  sourceName: string;
  sourceTier: SourceTier;
  sourceUrl: string;               // permalink to the original item
  title: string;
  content: string;                 // raw text/HTML content
  publishedAt: string;             // ISO8601
  discoveredAt: string;            // ISO8601 (when we fetched it)
  guid?: string;                   // RSS guid, HN id, etc.
}

// ── Candidate Signals (normalized) ───────────────────────

export type EvidenceLevel =
  | "official_changelog"           // direct from vendor changelog
  | "official_blog"                // vendor blog post
  | "verified_benchmark"           // reproducible benchmark result
  | "multi_source"                 // corroborated by 2+ independent sources
  | "single_credible"              // one credible source (e.g. HN top post)
  | "rumor"                        // unverified, single social post
  | "press_release";               // vendor PR — claims, not facts

export interface CandidateSignal {
  id: string;                      // SHA-256 of sourceId + title + date
  title: string;
  summary: string;                 // 2-3 sentence plain text
  category: SignalCategory;
  evidenceLevel: EvidenceLevel;
  sourceRefs: SourceRef[];         // one or more (post-dedup merge)
  entities: string[];              // companies, models, tools mentioned
  publishedAt: string;             // ISO8601
  discoveredAt: string;            // ISO8601
  rawClaims: string[];             // factual claims extracted from content
  dedupGroup: string | null;       // set during dedup
}

export interface SourceRef {
  sourceId: string;
  sourceName: string;
  sourceTier: SourceTier;
  url: string;
}

// ── Scoring ──────────────────────────────────────────────

export interface ScoreDimensions {
  soloDevUsefulness: number;       // 0-10
  actionability: number;           // 0-10
  urgency: number;                 // 0-10
  sourceCredibility: number;       // 0-10
  hypeRisk: number;                // 0-10 (high = bad, inverted in formula)
  costImpact: number;              // 0-10
  productionReadiness: number;     // 0-10
  buildOpportunity: number;        // 0-10
  workflowRelevance: number;       // 0-10
}

export interface ScoreJustifications {
  soloDevUsefulness: string;
  actionability: string;
  urgency: string;
  sourceCredibility: string;
  hypeRisk: string;
  costImpact: string;
  productionReadiness: string;
  buildOpportunity: string;
  workflowRelevance: string;
  worthMentioningReason: string;   // why this is worth including at all
  soloDevRelevance: string;        // specific solo-dev angle
}

export interface ScoredCandidate extends CandidateSignal {
  scores: ScoreDimensions;
  normalizedScore: number;         // 0-100
  justifications: ScoreJustifications;
  worthMentioning: boolean;        // normalized_score >= threshold
}

// ── Selection ────────────────────────────────────────────

export type SelectionRole =
  | "signal_1" | "signal_2" | "signal_3" | "signal_4" | "signal_5"
  | "try_this"
  | "memo_ignore"                  // private memo only — never in public brief
  | "dropped";

export interface SelectedCandidate extends ScoredCandidate {
  selectedAs: SelectionRole;
  selectionReason: string;
}

export interface Selection {
  signals: SelectedCandidate[];    // exactly 5
  tryThis: SelectedCandidate | null;
  memoIgnore: SelectedCandidate[];  // for private memo only
  dropped: ScoredCandidate[];      // considered but not selected
}

// ── Verify Gates ─────────────────────────────────────────

export type GateLevel = "blocking" | "advisory";

export interface GateResult {
  gateId: string;                  // "VG-SOURCE", "VG-HYPE", etc.
  level: GateLevel;
  passed: boolean;
  violations: string[];            // human-readable violation descriptions
}

export interface GateReport {
  allPassed: boolean;              // true only if all blocking gates passed
  blockingPassed: number;
  blockingFailed: number;
  advisoryPassed: number;
  advisoryFailed: number;
  results: GateResult[];
  ranAt: string;                   // ISO8601
}

// ── Run Metadata ─────────────────────────────────────────

export interface PipelineRun {
  runId: string;                   // UUID
  startedAt: string;               // ISO8601
  completedAt: string;             // ISO8601
  sourcesAttempted: number;
  sourcesFetched: number;
  sourcesFailed: string[];         // source IDs that errored
  rawItemCount: number;
  candidateCount: number;
  dedupMerges: number;
  scoredCount: number;
  selectedCount: number;
  gateReport: GateReport;
  sponsor: SponsorSlot;
  memoPath: string;                // relative path to memo.md
  briefPath: string;               // relative path to brief.md
  archivePath: string;             // relative path to run directory
}

// ── Sponsor ──────────────────────────────────────────────

export interface SponsorSlot {
  name: string;                    // "CalenCall"
  tagline: string;                 // "AI-powered phone reception..."
}

export interface SponsorConfig {
  sponsors: Array<{
    name: string;
    tagline: string;
    weight: number;
  }>;
}

// ── Scoring Config ───────────────────────────────────────

export interface ScoringConfig {
  weights: {
    soloDevUsefulness: number;     // 3
    actionability: number;         // 3
    urgency: number;               // 2
    sourceCredibility: number;     // 2
    hypeRisk: number;              // 2 (inverted)
    costImpact: number;            // 1
    productionReadiness: number;   // 1
    buildOpportunity: number;      // 1
    workflowRelevance: number;     // 1
  };
  thresholds: {
    strongCandidate: number;       // 70
    conditionalCandidate: number;  // 50
    weakCandidate: number;         // 30
  };
  maxPossible: number;             // 160
}

// ── Editorial Config ─────────────────────────────────────

export interface EditorialConfig {
  bannedSuperlatives: string[];
  hypePatterns: string[];
  affiliatePatterns: string[];
  cultureWarPatterns: string[];
  partisanPatterns: string[];
  moralPanicPatterns: string[];
  vendorCheeringPatterns: string[];
  tryNextPatterns: string[];
  sponsorExplainPatterns: string[];
}

// ── Fetcher Interface ────────────────────────────────────

export interface Fetcher {
  type: FetcherType;
  fetch(source: SourceDefinition, windowHours: number): Promise<RawItem[]>;
}
```

---

## 3. Source Registry Shape

File: `config/sources.json`

```json
{
  "fetchWindowHours": 28,
  "minTier1Sources": 3,
  "sources": [
    {
      "id": "openai-blog",
      "name": "OpenAI Blog",
      "tier": 1,
      "fetcherType": "rss",
      "url": "https://openai.com/blog/rss.xml",
      "category": "model_release",
      "enabled": true
    },
    {
      "id": "anthropic-news",
      "name": "Anthropic News",
      "tier": 1,
      "fetcherType": "rss",
      "url": "https://www.anthropic.com/rss.xml",
      "category": "model_release",
      "enabled": true
    },
    {
      "id": "github-blog",
      "name": "GitHub Blog",
      "tier": 1,
      "fetcherType": "rss",
      "url": "https://github.blog/feed/",
      "category": "tool_release",
      "enabled": true
    },
    {
      "id": "huggingface-blog",
      "name": "Hugging Face Blog",
      "tier": 1,
      "fetcherType": "rss",
      "url": "https://huggingface.co/blog/feed.xml",
      "category": "tool_release",
      "enabled": true
    },
    {
      "id": "ollama-releases",
      "name": "Ollama Releases",
      "tier": 1,
      "fetcherType": "github-releases",
      "url": "https://api.github.com/repos/ollama/ollama/releases",
      "category": "tool_release",
      "enabled": true
    },
    {
      "id": "vercel-ai-sdk",
      "name": "Vercel AI SDK Releases",
      "tier": 1,
      "fetcherType": "github-releases",
      "url": "https://api.github.com/repos/vercel/ai/releases",
      "category": "api_change",
      "enabled": true
    },
    {
      "id": "langchain-releases",
      "name": "LangChain Releases",
      "tier": 1,
      "fetcherType": "github-releases",
      "url": "https://api.github.com/repos/langchain-ai/langchainjs/releases",
      "category": "api_change",
      "enabled": true
    },
    {
      "id": "hackernews-ai",
      "name": "Hacker News (AI)",
      "tier": 2,
      "fetcherType": "hackernews",
      "url": "https://hn.algolia.com/api/v1/search",
      "category": "workflow_pattern",
      "enabled": true,
      "fetchOptions": {
        "tags": "story",
        "query": "AI OR LLM OR GPT OR Claude OR Gemini OR \"language model\"",
        "hitsPerPage": 30,
        "minPoints": 50
      }
    }
  ]
}
```

### Source selection rationale

| Source | Why included | Noise level |
|---|---|---|
| OpenAI Blog RSS | Primary AI provider, direct changelogs | Low |
| Anthropic News RSS | Primary AI provider, direct changelogs | Low |
| GitHub Blog RSS | AI coding tools, Copilot updates | Low-medium |
| Hugging Face Blog RSS | Open-source model releases, benchmarks | Low-medium |
| Ollama GitHub Releases | Local model runtime, direct relevance | Very low |
| Vercel AI SDK Releases | Popular AI framework, breaking changes | Very low |
| LangChain Releases | Popular AI framework, breaking changes | Low |
| Hacker News (filtered) | Community signal, trending AI stories | Medium (filtered by points threshold) |

### Sources explicitly deferred to Phase 2+

- X/Twitter (requires auth, high noise, dedup complexity)
- Reddit (API auth required, rate limiting)
- YouTube (transcript extraction, high noise)
- Google DeepMind blog (no reliable RSS — needs webpage scraper tuning)
- Meta AI blog (same — unreliable feed)
- Mistral blog (low frequency, add when stable feed found)
- Product Hunt (API auth, low signal density)
- arxiv (needs specialized parsing, research-to-practice gap)

---

## 4. Fetcher Interface

```typescript
// src/fetchers/interface.ts

import type { SourceDefinition, RawItem } from "../types.ts";

export interface Fetcher {
  type: string;
  fetch(source: SourceDefinition, windowHours: number): Promise<RawItem[]>;
}
```

Each fetcher is a pure function: takes a source definition and time window, returns raw items. No side effects, no state, no config beyond what the source definition provides.

### Fetcher implementations

**`rss.ts`** — Generic RSS/Atom parser. Uses a lightweight XML parser (e.g., `fast-xml-parser`). Extracts title, link, description/content, pubDate. Filters by `windowHours`. Handles both RSS 2.0 and Atom.

**`hackernews.ts`** — Uses the Algolia HN search API. Filters by `numericFilters=created_at_i>${unixTimestamp}` and `tags=story`. Respects `minPoints` from fetchOptions. Returns only stories above the points threshold.

**`github-releases.ts`** — Uses the GitHub REST API (`/repos/{owner}/{repo}/releases`). No auth required for public repos (rate limit: 60/hr unauthenticated, sufficient for 7 repos). Filters by `published_at` within window.

**`webpage.ts`** — Static HTML fetch + CSS selector extraction. For changelogs that don't have RSS. Not needed in Phase 1 initial source set but included for extensibility. Uses native `fetch()` + a lightweight HTML parser.

### Error handling

Every fetcher wraps its work in try/catch. On failure, it returns an empty array and the error is logged. The pipeline continues with partial data. The run metadata records which sources failed.

---

## 5. CandidateSignal Schema

Defined in full in Section 2 (`types.ts`). Key design decisions:

**`id`** — SHA-256 of `sourceId + title + publishedAt.toDateString()`. Same story from same source on same day always produces same ID. Cross-source dedup uses `dedupGroup`.

**`evidenceLevel`** — Assigned during normalization based on source tier and content analysis:
- Tier 1 source + changelog URL → `official_changelog`
- Tier 1 source + blog post → `official_blog`
- Tier 2 source with benchmark data → `verified_benchmark`
- Same story from 2+ sources → `multi_source`
- Single Tier 2 source → `single_credible`
- Everything else → `rumor` or `press_release`

**`rawClaims`** — Extracted during normalization. Each claim is a single factual assertion (e.g., "GPT-5 scores 92% on MMLU", "API pricing reduced by 40%"). Claims are used for dedup (same claims = same story) and for verify gates (claims must have source refs).

**`entities`** — Normalized company/product names. "OpenAI", "GPT-4", "Claude", "Cursor" — not "the latest model from OpenAI". Used for dedup grouping.

---

## 6. Scoring Function Design

### Phase 1 approach: deterministic heuristic scoring

Phase 1 does NOT use an LLM for scoring. Scoring is a deterministic function of:
- source tier → `sourceCredibility`
- evidence level → boosts/penalties on multiple dimensions
- entity keyword matching → `soloDevUsefulness`, `workflowRelevance`
- category → default urgency and actionability baselines
- content keyword scanning → `hypeRisk`, `costImpact`, `productionReadiness`

This makes the pipeline fully reproducible with zero API calls. LLM-based scoring is a Phase 2 upgrade when the heuristic baseline is calibrated.

### Scoring function

```typescript
// src/pipeline/score.ts

export function scoreCandidateHeuristic(
  candidate: CandidateSignal,
  config: ScoringConfig,
  editorial: EditorialConfig
): ScoredCandidate {
  const dims = computeDimensions(candidate, editorial);
  const raw = applyWeights(dims, config.weights);
  const normalized = (raw / config.maxPossible) * 100;

  return {
    ...candidate,
    scores: dims,
    normalizedScore: normalized,
    worthMentioning: normalized >= config.thresholds.weakCandidate,
    justifications: generateJustifications(candidate, dims),
  };
}
```

### Dimension computation rules

| Dimension | Heuristic |
|---|---|
| `soloDevUsefulness` | Base 5. +2 if entities include solo-dev tools (Cursor, Copilot, Claude Code, Ollama, etc.). +2 if category is `tool_release` or `api_change`. -3 if content mentions "enterprise", "team plan", "organization" without solo-dev context. |
| `actionability` | Base 4. +3 if category is `api_change` or `tool_release` (something changed you can act on). +2 if `pricing_change`. -2 if `benchmark` (interesting, not actionable). |
| `urgency` | Base 3. +4 if category is `deprecation` or `security_issue`. +2 if category is `outage`. +1 if published in last 6 hours. |
| `sourceCredibility` | Tier 1 = 8, Tier 2 = 5, Tier 3 = 3. +2 if `evidenceLevel` is `official_changelog`. -2 if `rumor`. |
| `hypeRisk` | Base 3. +3 if content matches hype patterns. +2 if superlatives present. -2 if `official_changelog`. |
| `costImpact` | Base 2. +6 if category is `pricing_change`. +2 if content mentions "free tier", "pricing", "cost". |
| `productionReadiness` | Base 5. +3 if `official_changelog` or `tool_release`. -4 if "coming soon", "preview", "beta", "alpha". |
| `buildOpportunity` | Base 3. +4 if category is `business_opportunity`. +2 if new API/capability. |
| `workflowRelevance` | Base 4. +3 if category is `workflow_pattern`. +2 if entities match common solo-dev tools. |

### Justification generation

Each justification is a template string explaining the score:

```
"soloDevUsefulness: 7/10 — tool_release category (+2), entities include Ollama (+2), base 5, no enterprise penalty"
```

These are for operator audit in the private memo. They do not appear in the public brief.

### Worth-mentioning threshold

`worthMentioning = normalizedScore >= 30` (the "weak candidate" threshold from the spec). Everything below 30 is dropped entirely. The `worthMentioningReason` is the combination of the top 3 scoring dimension justifications.

---

## 7. Deduplication Strategy

### Algorithm

1. **Exact ID match**: If two candidates have the same `id`, they're identical (same source, same title, same day). Keep the first, drop the second. This shouldn't happen in practice since each source only appears once.

2. **Entity overlap**: For every pair of candidates, compute Jaccard similarity of their `entities` arrays. If similarity >= 0.6 AND they share the same `category`, they likely refer to the same underlying event.

3. **Merge**: When candidates are grouped as duplicates:
   - Keep the candidate from the highest-tier source as primary
   - Merge `sourceRefs` from all duplicates into the primary
   - Upgrade `evidenceLevel` to `multi_source` if sources span 2+ distinct publishers
   - Union `rawClaims` and `entities`
   - Set `dedupGroup` to a shared group ID (hash of sorted entity set)

4. **Title similarity fallback**: If entity overlap is < 0.6 but normalized title similarity (Levenshtein ratio) > 0.8 AND same category, flag as potential duplicate for manual review. Do not auto-merge.

### Implementation

```typescript
// src/pipeline/dedup.ts

export function deduplicateCandidates(
  candidates: CandidateSignal[]
): { unique: CandidateSignal[]; mergeCount: number } {
  // 1. Sort by source tier (highest first)
  // 2. Build entity overlap matrix
  // 3. Group by Jaccard >= 0.6 + same category
  // 4. Merge groups, keeping highest-tier as primary
  // 5. Return unique candidates + merge count
}
```

No external dependencies. Jaccard similarity is trivial to implement. Title similarity uses a simple Levenshtein ratio.

---

## 8. Private Memo Generator

The private memo is the operator's full-context document. It includes everything the public brief includes plus:

- All scored candidates (not just selected ones)
- Score justifications for every candidate
- The "ignore pile" (items scored but rejected, with reasons)
- Source health report (which sources succeeded/failed)
- Dedup merge log
- Gate results (even if all passed)
- Scoring distribution histogram (text-based)

### Template: `templates/memo.md`

```markdown
# NIGHTLY LIBRARIAN — PRIVATE MEMO
# {{date}}
# Run: {{runId}}

## SOURCE HEALTH

Sources attempted: {{sourcesAttempted}}
Sources fetched:   {{sourcesFetched}}
Sources failed:    {{sourcesFailed}}

Failed sources:
{{#each failedSources}}
- {{this.id}}: {{this.error}}
{{/each}}

## RAW SIGNAL INVENTORY

Total raw items:    {{rawItemCount}}
After dedup:        {{candidateCount}} ({{dedupMerges}} merges)
Worth mentioning:   {{worthMentioningCount}}
Selected for brief: {{selectedCount}}

## SELECTED SIGNALS

{{#each signals}}
### Signal {{@index + 1}}: {{this.title}}

Score: {{this.normalizedScore}}/100
Category: {{this.category}}
Evidence: {{this.evidenceLevel}}
Sources: {{#each this.sourceRefs}}{{this.sourceName}} (T{{this.sourceTier}}){{/each}}

Justifications:
{{#each this.justifications}}
- {{@key}}: {{this}}
{{/each}}

{{/each}}

## TRY THIS

{{tryThis.title}}
Score: {{tryThis.normalizedScore}}/100
Reason selected: {{tryThis.selectionReason}}

## IGNORE PILE (private — not in public brief)

{{#each memoIgnore}}
### {{this.title}}
Score: {{this.normalizedScore}}/100
Why ignored: {{this.selectionReason}}
{{/each}}

## DROPPED CANDIDATES

{{#each dropped}}
- {{this.title}} ({{this.normalizedScore}}/100, {{this.category}})
{{/each}}

## SCORING DISTRIBUTION

{{scoringHistogram}}

## GATE RESULTS

{{#each gateResults}}
[{{#if this.passed}}PASS{{else}}FAIL{{/if}}] {{this.gateId}}: {{this.violations.length}} violations
{{#each this.violations}}
  - {{this}}
{{/each}}
{{/each}}

## SPONSOR

{{sponsor.name}} — {{sponsor.tagline}}
```

The memo is generated with simple string interpolation (Mustache-style above for illustration — actual implementation is template literals). No Handlebars dependency needed.

---

## 9. Public Brief Generator

The public brief follows the daily template from SPEC.md Section 5, with one critical change from the user's directive:

**No "Ignore This" section in the public brief.**

The "Ignore This" content is private-memo-only. The public brief contains:
- Sponsor line
- 5 Signals with Builder Impact
- Try This
- Librarian's Verdict

### Phase 1: template-fill approach

The public brief is assembled by filling the template with selected candidates. The editorial voice is applied through the template constraints and the verify gates — not through LLM rewriting.

In Phase 1, the brief content is:
- Signal summaries = the candidate's `summary` field (2-3 sentences from extraction)
- Builder Impact = the candidate's `soloDevRelevance` justification, reframed as reader-facing
- Try This = the highest-actionability candidate, framed as a concrete step
- Verdict = a templated sentence based on the day's category distribution

Phase 2 will add LLM-based editorial rewriting for voice consistency.

### Template: updated `templates/daily.md`

The existing template is already close. The implementation will:
1. Read the template
2. Replace `{{placeholders}}` with selected candidate data
3. Write to `archive/runs/YYYY-MM-DD-HHMMSS/brief.md`

---

## 10. Verify Gate Implementation

### Gate runner

```typescript
// src/gates/index.ts

export async function runGates(
  brief: string,
  selection: Selection,
  editorial: EditorialConfig,
  runMeta: Partial<PipelineRun>
): Promise<GateReport> {
  const gates: Gate[] = [
    // All blocking gates
    sourceRefGate,
    worthMentioningGate,
    soloDevRelevanceGate,
    evidenceLevelGate,
    sponsorPositionGate,
    sponsorExplainGate,
    affiliateLanguageGate,
    tryNextFramingGate,
    superlativesGate,
    hypeLanguageGate,
    cultureWarGate,
    partisanGate,
    moralPanicGate,
    vendorCheeringGate,
    dedupPublicGate,
    staleCheckGate,
    noIgnorePileGate,
  ];

  const results = gates.map(gate => gate(brief, selection, editorial, runMeta));

  return {
    allPassed: results.every(r => r.level !== "blocking" || r.passed),
    blockingPassed: results.filter(r => r.level === "blocking" && r.passed).length,
    blockingFailed: results.filter(r => r.level === "blocking" && !r.passed).length,
    advisoryPassed: results.filter(r => r.level === "advisory" && r.passed).length,
    advisoryFailed: results.filter(r => r.level === "advisory" && !r.passed).length,
    results,
    ranAt: new Date().toISOString(),
  };
}
```

### Gate specifications

Every gate is a pure function: `(brief, selection, editorial, runMeta) → GateResult`.

| Gate ID | Level | Check | Implementation |
|---|---|---|---|
| `VG-SOURCE` | blocking | Every public signal has ≥1 source URL | Scan brief for `Source:` lines; count must equal signal count; each must contain `http` |
| `VG-WORTH` | blocking | Every public signal has a worthMentioningReason | Check each selected signal's `justifications.worthMentioningReason` is non-empty |
| `VG-RELEVANCE` | blocking | Every public signal has soloDevRelevance justification | Check each selected signal's `justifications.soloDevRelevance` is non-empty and ≥10 words |
| `VG-EVIDENCE` | blocking | Every public signal has an evidence level | Check each selected signal's `evidenceLevel` is not `rumor` for signals 1-5 |
| `VG-SPONSOR-POS` | blocking | Sponsor text only in allowed slot | Regex: sponsor name/tagline must not appear after the `THE 5 SIGNALS` header |
| `VG-SPONSOR-EXPLAIN` | blocking | No sponsor explanation in editorial body | Scan for `editorial.sponsorExplainPatterns` after sponsor line |
| `VG-AFFILIATE` | blocking | No affiliate-style recommendation language | Scan brief for `editorial.affiliatePatterns`: "use my link", "discount code", "exclusive offer", "partner", "affiliate" |
| `VG-TRY-NEXT` | blocking | No "what you should try next" framing | Scan for `editorial.tryNextPatterns`: "you should try", "we recommend", "our pick", "must-have", "essential tool" |
| `VG-SUPERLATIVE` | blocking | No unsupported superlatives | Regex for "best", "revolutionary", "game-changing", "unprecedented", "groundbreaking", "transformative". Each match must have evidence within 50 words (number, benchmark, source cite). |
| `VG-HYPE` | blocking | No generic hype phrasing | Scan for `editorial.hypePatterns`: "changes everything", "the future of", "you won't believe", "mind-blowing", "insane", "wild" |
| `VG-CULTURE` | blocking | No culture-war framing | Scan for `editorial.cultureWarPatterns` (political identity terms, culture-war vocabulary) |
| `VG-PARTISAN` | blocking | No partisan commentary | Scan for `editorial.partisanPatterns` (party names, political figures in editorial context, policy debate language) |
| `VG-PANIC` | blocking | No moral panic framing | Scan for `editorial.moralPanicPatterns`: "threat to humanity", "existential risk", "AI will replace", "end of", "destroying" (in editorial voice, not in quoted claims) |
| `VG-VENDOR` | blocking | No vendor cheerleading | Scan for `editorial.vendorCheeringPatterns`: "excited to announce", "thrilled", "proud to", "amazing new", "incredible", "delighted" |
| `VG-DEDUP` | blocking | No duplicate stories in public brief | Pairwise Jaccard similarity on entities of the 5 signals; fail if any pair >= 0.6 |
| `VG-STALE` | blocking | No stale stories without `[CONTEXT]` marker | Check each signal's `publishedAt` is within 28h of run start, OR brief text for that signal contains `[CONTEXT]` |
| `VG-NO-IGNORE` | blocking | No "ignore pile" in public brief | Scan brief for "ignore this", "skip this", "safe to ignore", "you can ignore", section headers containing "ignore" |

### Pattern lists

Stored in `config/editorial.json`:

```json
{
  "bannedSuperlatives": [
    "best", "revolutionary", "game-changing", "unprecedented",
    "groundbreaking", "transformative", "disruptive"
  ],
  "hypePatterns": [
    "changes everything", "the future of", "you won't believe",
    "mind-blowing", "insane", "wild", "jaw-dropping",
    "a new era", "paradigm shift", "nothing will ever be the same"
  ],
  "affiliatePatterns": [
    "use my link", "discount code", "exclusive offer",
    "partner link", "affiliate", "referral",
    "use code", "sponsored by", "paid partnership"
  ],
  "cultureWarPatterns": [
    "woke", "anti-woke", "cancel culture", "virtue signal",
    "culture war", "political correctness", "snowflake",
    "triggered", "based", "red pill", "blue pill"
  ],
  "partisanPatterns": [
    "democrat", "republican", "liberal", "conservative",
    "left-wing", "right-wing", "MAGA", "progressive agenda",
    "socialist", "fascist"
  ],
  "moralPanicPatterns": [
    "threat to humanity", "existential risk", "AI will replace all",
    "end of", "destroying", "catastrophic", "doomsday",
    "humanity is doomed", "skynet", "terminator"
  ],
  "vendorCheeringPatterns": [
    "excited to announce", "thrilled", "proud to",
    "amazing new", "incredible", "delighted",
    "blown away", "love this", "huge fan of"
  ],
  "tryNextPatterns": [
    "you should try", "we recommend", "our pick",
    "must-have", "essential tool", "you need this",
    "don't miss", "act now", "limited time"
  ],
  "sponsorExplainPatterns": [
    "our sponsor", "thanks to our sponsor",
    "this issue is brought to you", "sponsored content",
    "a word from", "from our friends at"
  ]
}
```

---

## 11. Archive/Run Folder Format

Each pipeline run creates a timestamped directory:

```
archive/runs/2026-05-10-020000/
├── run.json              # PipelineRun metadata
├── raw-items.json        # All fetched RawItem[]
├── candidates.json       # All CandidateSignal[] (post-dedup)
├── scored.json           # All ScoredCandidate[]
├── selection.json        # Selection object (signals, tryThis, ignore, dropped)
├── memo.md               # Private memo
├── brief.md              # Public brief
└── gates.json            # GateReport
```

### File sizes (estimated)

| File | Estimated size | Purpose |
|---|---|---|
| `run.json` | 2-5 KB | Pipeline health, timing, counts |
| `raw-items.json` | 50-200 KB | Full fetcher output for debugging |
| `candidates.json` | 20-80 KB | Normalized signals for audit |
| `scored.json` | 30-100 KB | Scores + justifications for calibration |
| `selection.json` | 10-30 KB | What was picked and why |
| `memo.md` | 5-15 KB | Private operator brief |
| `brief.md` | 2-5 KB | Public reader brief |
| `gates.json` | 3-8 KB | Gate results for compliance |

Total per run: ~120-440 KB. At one run per night: ~12-44 MB per month. Negligible.

### Retention

No automatic cleanup in Phase 1. All runs are kept. At ~15 MB/month, this is not a concern for the first year.

---

## 12. CLI Commands

### package.json scripts

```json
{
  "scripts": {
    "nightly:fetch": "bun run src/index.ts fetch",
    "nightly:score": "bun run src/index.ts score",
    "nightly:draft": "bun run src/index.ts draft",
    "nightly:verify": "bun run src/index.ts verify",
    "nightly:run": "bun run src/index.ts run",
    "nightly:inspect": "bun run src/index.ts inspect",
    "test": "bun test",
    "typecheck": "bun run tsc --noEmit"
  }
}
```

### Command details

**`nightly:fetch`** — Runs stages 1-4 only (fetch → extract → normalize → dedup). Writes `raw-items.json` and `candidates.json` to a new run directory. Useful for testing source adapters without scoring.

```
$ bun run nightly:fetch
[fetch] Fetching from 8 sources...
[fetch] openai-blog: 3 items
[fetch] anthropic-news: 2 items
[fetch] github-blog: 5 items
[fetch] huggingface-blog: 4 items
[fetch] ollama-releases: 1 item
[fetch] vercel-ai-sdk: 0 items
[fetch] langchain-releases: 2 items
[fetch] hackernews-ai: 12 items
[fetch] 29 raw items fetched from 7/8 sources
[dedup] 4 merges → 25 unique candidates
[fetch] Wrote archive/runs/2026-05-10-020000/
```

**`nightly:score`** — Requires a prior fetch run. Reads `candidates.json` from the most recent (or specified) run, scores all candidates, writes `scored.json` and `selection.json`.

```
$ bun run nightly:score
# or: bun run nightly:score --run 2026-05-10-020000
```

**`nightly:draft`** — Requires a prior score run. Generates `memo.md` and `brief.md` from the selection.

```
$ bun run nightly:draft
# or: bun run nightly:draft --run 2026-05-10-020000
```

**`nightly:verify`** — Requires a prior draft run. Runs all verify gates against `brief.md`. Prints results. Exit code 0 = all blocking passed, exit code 1 = blocking failures.

```
$ bun run nightly:verify
[verify] Running 17 blocking gates...
[PASS] VG-SOURCE
[PASS] VG-WORTH
[PASS] VG-RELEVANCE
[FAIL] VG-SUPERLATIVE: "revolutionary" at line 14 without evidence
[PASS] VG-HYPE
...
[verify] 16/17 blocking gates passed, 1 failed
[verify] EXIT: BLOCKED (VG-SUPERLATIVE)
```

**`nightly:run`** — Full pipeline: fetch → score → draft → verify → archive. Does NOT publish. Prints a summary and exits with the verify gate status.

```
$ bun run nightly:run
[run] Starting full pipeline run...
[fetch] ... (same as above)
[score] 25 candidates scored. 8 worth mentioning.
[draft] Memo: 2,340 words. Brief: 1,120 words.
[verify] 17/17 blocking gates passed.
[archive] Run saved to archive/runs/2026-05-10-020000/
[run] DONE — brief ready for review at archive/runs/2026-05-10-020000/brief.md
```

**`nightly:inspect`** — Read-only. Prints a summary of the most recent run without re-executing anything.

```
$ bun run nightly:inspect
# or: bun run nightly:inspect --run 2026-05-10-020000
```

### CLI entry point

```typescript
// src/index.ts

const command = process.argv[2];
const runFlag = process.argv.indexOf("--run");
const runId = runFlag !== -1 ? process.argv[runFlag + 1] : undefined;

switch (command) {
  case "fetch":  await runFetch(); break;
  case "score":  await runScore(runId); break;
  case "draft":  await runDraft(runId); break;
  case "verify": await runVerify(runId); break;
  case "run":    await runFull(); break;
  case "inspect": await runInspect(runId); break;
  default:
    console.error(`Unknown command: ${command}`);
    console.error("Commands: fetch, score, draft, verify, run, inspect");
    process.exit(1);
}
```

No CLI framework dependency. Argument parsing is 10 lines.

---

## 13. Test Strategy

### Test categories

| Category | Scope | Runner | Count (est.) |
|---|---|---|---|
| Unit: fetchers | Parse fixture data, no network | `bun test` | 8-12 |
| Unit: normalize | RawItem → CandidateSignal mapping | `bun test` | 6-10 |
| Unit: dedup | Entity Jaccard, merge logic | `bun test` | 8-12 |
| Unit: score | Dimension heuristics, threshold math | `bun test` | 10-15 |
| Unit: gates | Each gate against crafted inputs | `bun test` | 17+ (one per gate minimum) |
| Integration: pipeline | Full fetch→archive with fixtures | `bun test` | 3-5 |
| Smoke: live sources | Fetch from real sources, check parse | Manual / CI | 1 |

### What to test first

1. **Gates** — these are the editorial contract enforcement. Every gate gets at least 2 tests: one passing input, one failing input with the expected violation message.
2. **Dedup** — Jaccard similarity math, merge behavior, edge cases (empty entities, all identical).
3. **Score** — Dimension computation for each heuristic rule. Threshold boundaries.
4. **Fetchers** — Parse fixtures (RSS XML, HN JSON, GitHub releases JSON). No network calls in tests.

### What NOT to test in Phase 1

- LLM-based scoring (doesn't exist in Phase 1)
- Publishing (doesn't exist in Phase 1)
- Weekly digests (Phase 2)
- Webpage scraper (not in initial source set)

### Test fixtures

Pre-captured responses from each source, stored as static files in `test/fixtures/`. Each fixture includes 3-5 items, some within the 28h window and some outside.

### Regression: golden file testing for gates

The gate test suite includes a "golden file" approach: a complete `brief.md` that is known-good (all gates pass), and a set of mutations (insert a superlative, remove a source ref, add vendor cheerleading) that are known-bad. Each mutation must trigger exactly the expected gate failure.

---

## 14. Phase 1 Acceptance Criteria

Phase 1 is DONE when all of the following are true:

### Pipeline runs end-to-end

- [ ] `bun run nightly:run` completes without errors
- [ ] At least 5 sources return data
- [ ] At least 10 raw items are extracted
- [ ] At least 3 candidates score above the worth-mentioning threshold
- [ ] `memo.md` is generated with all required sections
- [ ] `brief.md` is generated with all required sections
- [ ] All run artifacts are saved to the archive directory

### Verify gates enforce the editorial contract

- [ ] All 17 blocking gates are implemented
- [ ] Each gate has at least 2 tests (pass + fail)
- [ ] `bun run nightly:verify` exits 0 on a clean brief
- [ ] `bun run nightly:verify` exits 1 when any blocking gate fails
- [ ] Gate violations produce human-readable messages

### Outputs are correct

- [ ] Public brief contains exactly 5 signals
- [ ] Every signal has a source URL
- [ ] Every signal has a Builder Impact section
- [ ] Every signal has an evidence level
- [ ] "Try This" is concrete (names a tool/technique)
- [ ] No "Ignore This" section appears in the public brief
- [ ] Private memo contains the ignore pile, all scores, all justifications
- [ ] Sponsor line appears only in the allowed position

### Code quality

- [ ] `bun run tsc --noEmit` passes (zero type errors)
- [ ] `bun test` passes (all tests green)
- [ ] No runtime dependencies beyond `fast-xml-parser` (for RSS parsing)
- [ ] No LLM API calls required at runtime
- [ ] No Second Brain dependency
- [ ] No Claude Code dependency
- [ ] Pipeline is reproducible: same inputs produce same outputs

### Operational

- [ ] `bun run nightly:inspect` shows run summary
- [ ] Failed sources are logged but do not crash the pipeline
- [ ] Archive directory structure matches the spec

---

## 15. Exact Files to Create

### Core (must exist for `nightly:run` to work)

| # | File | Purpose | Est. lines |
|---|---|---|---|
| 1 | `package.json` | Project manifest, scripts, dependencies | 30 |
| 2 | `tsconfig.json` | TypeScript strict config | 15 |
| 3 | `bunfig.toml` | Bun config (if needed) | 5 |
| 4 | `src/index.ts` | CLI entry point + command router | 80 |
| 5 | `src/types.ts` | All shared types | 200 |
| 6 | `src/config.ts` | Config loader | 50 |
| 7 | `src/fetchers/interface.ts` | Fetcher interface | 10 |
| 8 | `src/fetchers/rss.ts` | RSS/Atom fetcher | 80 |
| 9 | `src/fetchers/hackernews.ts` | HN API fetcher | 60 |
| 10 | `src/fetchers/github-releases.ts` | GitHub releases fetcher | 60 |
| 11 | `src/pipeline/fetch.ts` | Orchestrate all fetchers | 70 |
| 12 | `src/pipeline/extract.ts` | Raw response → RawItem[] | 40 |
| 13 | `src/pipeline/normalize.ts` | RawItem[] → CandidateSignal[] | 80 |
| 14 | `src/pipeline/dedup.ts` | Deduplicate candidates | 100 |
| 15 | `src/pipeline/score.ts` | Heuristic scoring | 150 |
| 16 | `src/pipeline/select.ts` | Pick signals, tryThis, ignore | 80 |
| 17 | `src/pipeline/memo.ts` | Generate private memo | 120 |
| 18 | `src/pipeline/brief.ts` | Generate public brief | 100 |
| 19 | `src/pipeline/verify.ts` | Run all gates (delegates to gates/) | 50 |
| 20 | `src/pipeline/archive.ts` | Write run directory | 60 |
| 21 | `src/gates/index.ts` | Gate runner + types | 60 |
| 22 | `src/gates/source-ref.ts` | VG-SOURCE | 25 |
| 23 | `src/gates/worth-mentioning.ts` | VG-WORTH | 25 |
| 24 | `src/gates/solo-dev-relevance.ts` | VG-RELEVANCE | 25 |
| 25 | `src/gates/evidence-level.ts` | VG-EVIDENCE | 25 |
| 26 | `src/gates/sponsor-position.ts` | VG-SPONSOR-POS | 30 |
| 27 | `src/gates/sponsor-explain.ts` | VG-SPONSOR-EXPLAIN | 25 |
| 28 | `src/gates/affiliate-language.ts` | VG-AFFILIATE | 25 |
| 29 | `src/gates/try-next-framing.ts` | VG-TRY-NEXT | 25 |
| 30 | `src/gates/superlatives.ts` | VG-SUPERLATIVE | 40 |
| 31 | `src/gates/hype-language.ts` | VG-HYPE | 25 |
| 32 | `src/gates/culture-war.ts` | VG-CULTURE | 25 |
| 33 | `src/gates/partisan.ts` | VG-PARTISAN | 25 |
| 34 | `src/gates/moral-panic.ts` | VG-PANIC | 25 |
| 35 | `src/gates/vendor-cheering.ts` | VG-VENDOR | 25 |
| 36 | `src/gates/dedup-public.ts` | VG-DEDUP | 30 |
| 37 | `src/gates/stale-check.ts` | VG-STALE | 30 |
| 38 | `src/gates/no-ignore-pile.ts` | VG-NO-IGNORE | 25 |
| 39 | `src/util/hash.ts` | SHA-256 content hashing | 15 |
| 40 | `src/util/date.ts` | Date helpers | 30 |
| 41 | `src/util/text.ts` | Word count, keyword scanning | 40 |
| 42 | `src/util/logger.ts` | Structured console logger | 30 |

### Config (must exist)

| # | File | Purpose |
|---|---|---|
| 43 | `config/sources.json` | Source registry |
| 44 | `config/scoring.json` | Weights + thresholds |
| 45 | `config/editorial.json` | Blocklists + patterns |
| 46 | `config/sponsors.json` | Sponsor rotation |

### Templates (must exist)

| # | File | Purpose |
|---|---|---|
| 47 | `templates/memo.md` | Private memo template |
| 48 | `templates/daily.md` | Public brief template (update existing) |

### Tests (must exist for acceptance)

| # | File | Purpose |
|---|---|---|
| 49 | `test/fixtures/rss-sample.xml` | Sample RSS fixture |
| 50 | `test/fixtures/hn-sample.json` | Sample HN API fixture |
| 51 | `test/fixtures/gh-releases-sample.json` | Sample GitHub releases fixture |
| 52 | `test/fixtures/candidates-scored.json` | Pre-scored candidates for gate tests |
| 53 | `test/fixtures/brief-clean.md` | Golden file: clean brief (all gates pass) |
| 54 | `test/fetchers/rss.test.ts` | RSS parser tests |
| 55 | `test/fetchers/hackernews.test.ts` | HN parser tests |
| 56 | `test/fetchers/github-releases.test.ts` | GH releases parser tests |
| 57 | `test/pipeline/normalize.test.ts` | Normalization tests |
| 58 | `test/pipeline/dedup.test.ts` | Dedup tests |
| 59 | `test/pipeline/score.test.ts` | Scoring heuristic tests |
| 60 | `test/gates/gate-runner.test.ts` | Gate runner integration test |
| 61 | `test/gates/superlatives.test.ts` | Superlative gate tests |
| 62 | `test/gates/sponsor-position.test.ts` | Sponsor position gate tests |
| 63 | `test/gates/no-ignore-pile.test.ts` | No-ignore gate tests |

**Total: 63 files. ~2,200 estimated lines of source + ~800 lines of tests + ~200 lines of config/fixtures.**

---

## 16. Non-Goals

| Non-goal | Reason |
|---|---|
| LLM-based scoring | Phase 1 uses deterministic heuristics for reproducibility |
| LLM-based editorial rewriting | Phase 1 uses template-fill; LLM voice is Phase 2 |
| Email publishing (Buttondown) | Phase 1 stops at archive; publish is Phase 2 |
| Web archive / static site | Phase 1 outputs files; hosting is Phase 2 |
| Weekly digest generation | Phase 1 is daily-only |
| Reddit, X/Twitter, YouTube sources | High noise, auth complexity; Phase 2+ |
| Subscriber management | No subscribers in Phase 1 |
| Paid tier | Not designed yet |
| Second Brain integration | Explicitly excluded from Phase 1 runtime |
| Claude Code runtime dependency | Pipeline must run standalone |
| CMS or admin UI | CLI-only |
| Webpage scraper for changelogs without RSS | Not needed for initial source set |
| A/B testing | Premature |
| Analytics | Premature |
| CI/CD pipeline for the project itself | Manual runs in Phase 1 |
| Cron scheduling | Manual trigger in Phase 1; cron is Phase 2 |

---

## 17. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RSS feeds change format or go offline | Medium | Medium | Each fetcher handles parse errors gracefully; pipeline continues with partial data; `run.json` records failures |
| HN API rate limiting | Low | Low | Single query per run; well under rate limits |
| GitHub API rate limiting (unauthenticated) | Low | Medium | 60 req/hr limit; 7 repos = 7 requests per run. Add `GITHUB_TOKEN` env var support for authenticated requests if needed. |
| Heuristic scoring is miscalibrated | High | Medium | Expected for Phase 1. Scoring weights are in `config/scoring.json` and tunable without code changes. Each run archives all scores for calibration review. |
| Too few candidates pass worth-mentioning threshold | Medium | Medium | If fewer than 5 candidates pass, the pipeline generates a short-form brief with whatever qualified + `[CONTEXT]` signals from the last 7 days of archive |
| Gate false positives (valid content flagged) | Medium | Low | Review gate results in `gates.json`; tune patterns in `editorial.json` without code changes |
| Gate false negatives (bad content passes) | Medium | High | Human review is the backstop in Phase 1. Gate pattern lists are maintained in config and expanded as violations are discovered. |
| fast-xml-parser has a breaking update | Low | Low | Pin version in package.json |
| Bun compatibility issues | Low | Medium | All code is standard TypeScript; Node.js fallback is trivial (swap `bun test` → `vitest`, `bun run` → `npx tsx`) |

---

## 18. Implementation Sequence

Build in this order. Each step is independently testable.

### Step 1: Scaffold (30 min)

Create `package.json`, `tsconfig.json`, `bunfig.toml`. Set up directory structure. Install `fast-xml-parser`. Write `src/types.ts`.

**Verify**: `bun run tsc --noEmit` passes.

### Step 2: Config + Utilities (30 min)

Write `config/*.json` files. Write `src/config.ts` loader. Write `src/util/hash.ts`, `src/util/date.ts`, `src/util/text.ts`, `src/util/logger.ts`.

**Verify**: `bun test` passes for utility functions.

### Step 3: Fetchers (1-2 hr)

Write `src/fetchers/interface.ts`, `rss.ts`, `hackernews.ts`, `github-releases.ts`. Write test fixtures and tests.

**Verify**: `bun test test/fetchers/` passes. Each fetcher parses its fixture correctly.

### Step 4: Pipeline stages 1-4 (1-2 hr)

Write `src/pipeline/fetch.ts` (orchestrator), `extract.ts`, `normalize.ts`, `dedup.ts`. Write normalize and dedup tests.

**Verify**: `bun run nightly:fetch` runs against live sources and produces `candidates.json`.

### Step 5: Scoring (1 hr)

Write `src/pipeline/score.ts` with all dimension heuristics. Write scoring tests.

**Verify**: `bun run nightly:score` produces `scored.json` with plausible scores.

### Step 6: Selection (30 min)

Write `src/pipeline/select.ts`. Select top 5 signals, best tryThis, ignore pile.

**Verify**: `bun run nightly:score` produces `selection.json` with exactly 5 signals + tryThis.

### Step 7: Memo + Brief generation (1 hr)

Write `templates/memo.md`, update `templates/daily.md`. Write `src/pipeline/memo.ts` and `src/pipeline/brief.ts`.

**Verify**: `bun run nightly:draft` produces readable `memo.md` and `brief.md`.

### Step 8: Verify gates (2-3 hr)

Write all 17 gate implementations in `src/gates/`. Write gate runner. Write gate tests (at least 2 per gate).

**Verify**: `bun run nightly:verify` reports correct results. `bun test test/gates/` passes.

### Step 9: Archive + CLI (30 min)

Write `src/pipeline/archive.ts`. Wire up `src/index.ts` CLI entry point with all commands.

**Verify**: `bun run nightly:run` completes end-to-end. Archive directory contains all expected files.

### Step 10: Integration test + cleanup (1 hr)

Run full pipeline against live sources. Review output quality. Fix any issues. Write `test/gates/gate-runner.test.ts` integration test against golden file.

**Verify**: All acceptance criteria from Section 14 are met.

**Estimated total: 8-12 hours of implementation.**

---

## 19. Verify Commands (Final)

```bash
# Type check
bun run tsc --noEmit

# Run all tests
bun test

# Run specific test suites
bun test test/fetchers/
bun test test/pipeline/
bun test test/gates/

# Full pipeline run
bun run nightly:run

# Verify gates on most recent run
bun run nightly:verify

# Inspect most recent run
bun run nightly:inspect

# Verify a specific run
bun run nightly:verify --run 2026-05-10-020000
```

---

## 20. Definition of DONE

Phase 1 is complete when:

1. `bun run tsc --noEmit` exits 0
2. `bun test` exits 0 with all tests passing
3. `bun run nightly:run` completes end-to-end against live sources
4. The generated `brief.md` passes all 17 blocking verify gates
5. The generated `memo.md` contains scores, justifications, and ignore pile
6. No runtime dependency on Second Brain, Claude Code, or any LLM API
7. All 63 files from Section 15 exist
8. Archive directory contains the complete run artifacts
9. A human reads `brief.md` and confirms it looks like a useful intelligence brief

---

## Appendix: Dependencies

### Runtime

| Package | Version | Purpose | Size |
|---|---|---|---|
| `fast-xml-parser` | ^5.x | RSS/Atom XML parsing | ~50 KB |

That's it. One dependency. Everything else uses Bun/Node built-ins:
- `fetch()` — native in Bun and Node 18+
- `crypto` — native (for SHA-256)
- `fs/promises` — native (for file I/O)
- `path` — native

### Dev

| Package | Purpose |
|---|---|
| `typescript` | Type checking (Bun has built-in TS support for execution) |
| `@types/bun` | Bun type definitions |

---

## Appendix: Config File Contents

### `config/scoring.json`

```json
{
  "weights": {
    "soloDevUsefulness": 3,
    "actionability": 3,
    "urgency": 2,
    "sourceCredibility": 2,
    "hypeRisk": 2,
    "costImpact": 1,
    "productionReadiness": 1,
    "buildOpportunity": 1,
    "workflowRelevance": 1
  },
  "thresholds": {
    "strongCandidate": 70,
    "conditionalCandidate": 50,
    "weakCandidate": 30
  },
  "maxPossible": 160
}
```

### `config/sponsors.json`

```json
{
  "sponsors": [
    {
      "name": "CalenCall",
      "tagline": "AI-powered phone reception for solo tradespeople.",
      "weight": 3
    },
    {
      "name": "Veremun",
      "tagline": "Verify any contractor's license in seconds.",
      "weight": 3
    },
    {
      "name": "Pi",
      "tagline": "Your second brain for AI-assisted development.",
      "weight": 1
    }
  ]
}
```
