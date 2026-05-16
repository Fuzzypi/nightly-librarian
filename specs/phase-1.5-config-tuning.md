# Spec: Nightly Librarian Phase 1.5 — Config Tuning

## Objective

Make the Nightly Librarian pipeline produce a publishable brief on a typical day.

The first live dry-run (2026-05-09, run `8d75a040`) exposed four problems:
1. **Source starvation** — 7/8 sources returned 0 items. Only 1 candidate reached scoring.
2. **Broken source** — anthropic-news URL returns HTTP 404. Anthropic has no public RSS feed.
3. **Content-blind scoring** — `soloDevRelevance` text is a category template, not content-derived. An oncology paper was described as "directly affects tools and APIs that solo developers rely on."
4. **No content-quality floor** — a candidate with `summary: ""` passed all gates and produced "No summary available" in the brief.

Phase 1.5 fixes these with config changes, small code changes to the scoring/selection pipeline, and one new gate. No LLM calls. No new fetcher types. No architecture changes.

**Who this is for**: The pipeline operator (Fuzzy) evaluating whether the Nightly Librarian can produce useful output before investing in Phase 2 (LLM scoring, Buttondown, social sources).

**Success looks like**: Running `bun run nightly:run` on a normal weekday produces a brief with 5 signals that a solo developer would actually want to read, with accurate builder-impact descriptions and no empty-summary entries.

## Tech Stack

- Runtime: Bun 1.3.x
- Language: TypeScript (strict mode)
- Config: JSON files in `config/`
- Tests: bun:test (60 tests across 10 files)
- No external dependencies added

## Commands

```
Build:    bun run typecheck
Test:     bun test
Run:      bun run nightly:run
Verify:   bun run nightly:verify -- --run <dir-name>
```

## Project Structure

```
config/
  sources.json      ← source definitions (URLs, tiers, categories)
  scoring.json      ← dimension weights, thresholds, maxPossible
  editorial.json    ← banned patterns, hype/affiliate/sponsor detection
src/
  pipeline/score.ts ← scoring dimensions + soloDevRelevance generation
  pipeline/select.ts ← candidate selection (top-5 + tryThis + ignore)
  pipeline/brief.ts  ← brief template generation
  pipeline/memo.ts   ← private memo generation
  fetchers/hackernews.ts ← HN Algolia fetcher
  gates/signal-count.ts  ← VG-COUNT gate (exactly 5 signals)
  types.ts           ← shared type definitions
test/
  *.test.ts          ← unit tests per module
```

## Changes

### 1. Source Config (`config/sources.json`)

**1a. Disable anthropic-news.**
Anthropic has no public RSS feed. Confirmed: all standard paths (`/rss.xml`, `/feed.xml`, `/news/rss`, `/atom.xml`, `/research.rss`) return 404. Set `"enabled": false` and add a comment in the `name` field: `"Anthropic News (DISABLED — no RSS feed)"`.

**1b. Update OpenAI URL.**
Current URL `https://openai.com/blog/rss.xml` returns 307 → `https://openai.com/news/rss.xml`. Update to the canonical URL to avoid a redirect hop.

**1c. Add high-cadence sources.**
The current source set has 3 GitHub-releases sources (weekly/monthly cadence) and 4 blog sources (irregular cadence). On a quiet day, none publish. Add sources with near-daily cadence:

| ID | Name | Type | URL | Tier | Category |
|----|------|------|-----|------|----------|
| `simonwillison` | Simon Willison's Blog | rss | `https://simonwillison.net/atom/everything/` | 2 | workflow_pattern |
| `ai-tidbits-hn` | Hacker News (AI Tidbits) | hackernews | (same Algolia API, different query/thresholds) | 2 | workflow_pattern |
| `llama-cpp-releases` | llama.cpp Releases | github-releases | `https://api.github.com/repos/ggml-org/llama.cpp/releases` | 1 | tool_release |
| `cursor-changelog` | Cursor Changelog | rss | `https://changelog.cursor.com/feed.xml` | 1 | tool_release |

**1d. Add a second HN query with lower threshold.**
The current HN source requires 50+ points, which is too high for a 28h window. Add a second HN source entry (`ai-tidbits-hn`) with `minPoints: 20` and a more focused query: `"Claude" OR "GPT" OR "Cursor" OR "Copilot" OR "ollama" OR "llama.cpp"`. This catches solo-dev-relevant stories that don't hit 50 points.

**1e. Widen fetch window.**
Change `fetchWindowHours` from 28 to 36. This catches items published late in the day that the previous run missed. Dedup prevents double-counting across runs.

**Target**: 12 sources (was 8). At least 3-5 should return items on any given day.

### 2. HN Fetcher Optimization (`src/fetchers/hackernews.ts`)

Add `points>=${minPoints}` to the `numericFilters` parameter sent to the Algolia API.

Current code only sends `created_at_i>${cutoffUnix}` as a numeric filter, then filters points client-side. This means the 30-result page may be filled with low-point stories, hiding high-point ones that would rank lower by Algolia relevance.

Change line 50 from:
```
numericFilters: `created_at_i>${cutoffUnix}`,
```
to:
```
numericFilters: `created_at_i>${cutoffUnix},points>=${minPoints}`,
```

This is a one-line code change. Update existing HN tests to verify the `numericFilters` parameter includes the points constraint.

### 3. Content-Quality Floor

**3a. New gate: VG-CONTENT**
Add a blocking gate that fails if any selected signal has an empty or missing summary.

Check: for each signal block in the brief, verify the line after the title is not `"No summary available."` and is not blank.

File: `src/gates/content-quality.ts`
Register in: `src/gates/index.ts`

**3b. Skip empty candidates in selection.**
In `src/pipeline/select.ts`, filter out candidates with empty `summary` before ranking. A candidate with no summary provides no value — it should fall to the dropped pile, not fill a signal slot.

This prevents VG-CONTENT from failing on something the selector should never have chosen.

### 4. Scoring: Content-Aware soloDevRelevance (`src/pipeline/score.ts`)

**4a. Replace category templates with title+summary-derived text.**

The current `generateSoloDevRelevance()` function (lines 122-146) returns hardcoded strings per category. An oncology paper tagged `tool_release` gets "Directly affects tools and APIs that solo developers rely on." This is always wrong for off-topic items and always generic for on-topic ones.

Replace with a function that:
1. Checks title + summary text against the `SOLO_DEV_TOOLS` list. If a match exists, name the tool: "Updates to [Cursor/Ollama/etc] — directly affects your local dev workflow."
2. Checks for pricing/cost keywords. If found: "Pricing change for [service] — review your usage and budget impact."
3. Checks for deprecation/breaking-change keywords. If found: "Breaking change — check if your dependencies are affected."
4. Falls back to a honest generic: "General AI signal — evaluate relevance to your stack." (Not "directly affects tools you rely on.")

This is still heuristic, not LLM. But it's honest heuristic — it says what it actually knows instead of claiming relevance it can't verify.

**4b. Add a content-length penalty to scoring.**
In `computeDimensions()`, if `candidate.summary` is empty, apply:
- `soloDevUsefulness -= 3`
- `actionability -= 3`

A candidate with no summary cannot be useful or actionable. This makes empty-content candidates score lower and naturally fall out of selection.

### 5. Editorial Config (`config/editorial.json`)

**5a. Remove overbroad sponsor-explanation patterns.**
Remove `"because it"` and `"because they"` from `sponsorExplainPatterns`. These are normal English connectors that will false-positive on any technical explanation (e.g., "we chose TypeScript because it has better tooling").

**5b. Tighten vendor-cheering pattern.**
Change `"love this"` to `"we love this"` to avoid matching developer reactions in HN comments.

### 6. Memo Source-Health Notes (`src/pipeline/memo.ts`)

Add a "Source notes" subsection under SOURCE HEALTH that explains 0-item sources:
- If a source returned 0 items (not failed), note: `"[source]: No items in fetch window"`
- If a source failed, the existing failure line already covers it.

This helps the operator distinguish "quiet day" from "broken fetcher" without digging into logs.

## Code Style

Follows existing patterns. Example from the codebase:

```typescript
export const contentQualityGate: Gate = (brief) => {
  const violations: string[] = [];
  const signalsSection = brief.match(/─── THE 5 SIGNALS ─+\n([\s\S]*?)(?=─── TRY THIS)/)?.[1] ?? "";
  const blocks = signalsSection.split(/(?=^\d+\.\s)/m).filter(b => /^\d+\.\s/.test(b));

  for (const block of blocks) {
    const titleMatch = block.match(/^\d+\.\s+(.+)/);
    const title = titleMatch?.[1]?.trim() ?? "(unknown)";
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2 || lines[1] === "No summary available.") {
      violations.push(`Signal "${title}" has no summary content.`);
    }
  }

  return { gateId: "VG-CONTENT", level: "blocking", passed: violations.length === 0, violations };
};
```

Key conventions:
- `const` over `let`, never `var`
- Guard clauses, early returns
- No functions > 30 lines
- No comments unless non-obvious why

## Testing Strategy

- Framework: `bun:test`
- Tests live in `test/` directory
- Each change gets a test:
  - New gate (VG-CONTENT): test empty-summary detection, test pass case
  - HN fetcher: verify `numericFilters` includes points
  - Scoring: verify empty-summary penalty, verify improved soloDevRelevance text
  - Selection: verify empty-summary candidates are skipped
  - Memo: verify source-notes section appears for 0-item sources
- Run full suite after all changes: `bun test` must stay at 60+ pass, 0 fail
- Run `bun run typecheck` must stay clean

## Boundaries

**Always:**
- Run `bun test` and `bun run typecheck` after every change
- Update existing tests when behavior changes
- Keep config changes in config files, code changes in src files
- Verify with `bun run nightly:run` after all changes

**Ask first:**
- Adding a source that requires authentication (API keys)
- Changing VG-COUNT from exactly 5 to a range
- Any change to the brief template layout
- Adding new dependencies

**Never:**
- Add LLM API calls (that's Phase 2)
- Change the archive format
- Add new fetcher types
- Modify the sponsor slot behavior
- Change the verify exit-code semantics

## Success Criteria

1. `bun run nightly:run` produces a brief with 5 signals (VG-COUNT passes)
2. All 18+ gates pass (including new VG-CONTENT)
3. No signal in the brief has "No summary available"
4. No `soloDevRelevance` text claims "directly affects tools and APIs" for off-topic items
5. anthropic-news is disabled, not silently failing
6. HN fetcher returns >0 items on a typical day
7. `bun test` passes with 0 failures
8. `bun run typecheck` is clean
9. Private memo shows source-health notes for 0-item sources
10. `sponsorExplainPatterns` no longer contains `"because it"` or `"because they"`

## Open Questions

1. **Cursor changelog URL**: `https://changelog.cursor.com/feed.xml` needs verification — if it 404s, we drop it from the source list. Should I verify before implementing?
2. **Simon Willison's feed**: His Atom feed covers everything (links + posts). Should we filter to posts only, or is the high volume acceptable with scoring handling relevance?
3. **fetchWindowHours 36 vs 48**: 36h gives one overlap window. 48h gives more safety but more dedup work. Preference?
4. **VG-COUNT flexibility**: Current gate requires exactly 5. If after all tuning we still sometimes get 3-4 valid candidates, should we relax to 3-5? Or is "exactly 5 or don't publish" the right editorial standard?
