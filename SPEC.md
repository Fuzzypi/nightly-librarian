# The Nightly Librarian — MVP Spec

**Version**: 0.1.0  
**Date**: 2026-05-09  
**Status**: Draft  
**Author**: Fuzzy + Claude (architect session AOS-146)

---

## 1. Executive Summary

The Nightly Librarian is a free daily intelligence brief that filters the last 24 hours of AI news into what matters for solo developers. It runs an automated pipeline nightly: discover sources, extract candidates, score for solo-builder relevance, deduplicate, generate a draft, run deterministic verification gates, and publish. Weekly digests synthesize the week's signals into actionable patterns.

The MVP is a single-operator system: one scheduled agent job produces one daily artifact (email/web post) with optional human review. No CMS, no subscriber management beyond a mailing list provider, no paid tier.

---

## 2. Product Positioning

**What it is**: A nightly anti-noise intelligence brief for solo builders.

**What it is not**: A generic AI newsletter, an enterprise strategy report, a VC signal tracker, or a tech-news aggregator.

**Core promise**: Every night, The Nightly Librarian filters the last 24 hours of AI chaos into what matters, what is useful, what to try, and what solo developers can safely ignore.

**Tagline candidates**:
- "The AI signal, without the noise."
- "24 hours of AI chaos. 5 minutes of clarity."
- "Built for builders. Not for boardrooms."

**Differentiators**:
| Other newsletters | The Nightly Librarian |
|---|---|
| Cover everything | Cover only what affects solo builders |
| Neutral tone, no opinion | Opinionated on practical impact |
| Sponsored tool lists | Zero vendor influence on content |
| Enterprise-forward | Solo-dev-first |
| Summary of announcements | Builder impact analysis |
| Weekly or inconsistent | Nightly, every night |

---

## 3. Target Reader

**Primary**: Solo developers, indie hackers, technical founders, automation builders, one-person software shops.

**Profile**:
- Ships software alone or in teams of 1–3
- Uses AI tools in daily workflow (coding agents, API calls, automation)
- Time-constrained — cannot monitor AI news all day
- Pragmatic — cares about "can I use this" not "is this impressive"
- Skeptical of hype — burned by overpromising before
- Cost-sensitive — tracks API pricing, free-tier changes, model cost shifts

**Not the target**: Enterprise architects, VC analysts, AI researchers (unless building solo), journalists, students with no shipping pressure.

---

## 4. Editorial Contract

The publication commits to:

| Principle | Meaning |
|---|---|
| Useful | Every item must answer "so what?" for a solo builder |
| Non-partisan | No political framing, no culture-war angles |
| Non-outrage | No rage-bait, no doom-loop engagement |
| Objective sourcing | Primary sources only; no single-source claims |
| Opinionated on impact | Clear "this matters / this doesn't" judgments |
| Hostile to hype | Superlatives require evidence; "revolutionary" is banned without proof |
| Hostile to vendor fog | No press-release parroting; surface what changed, not what was announced |
| Hostile to fake recommendations | No affiliate links, no pay-for-placement |
| Clear about uncertainty | "We don't know yet" is a valid and encouraged editorial position |
| Focused on actionable impact | Every signal must connect to something the reader can do or decide |

The publication must avoid:

- Enterprise strategy filler
- Generic AI futurism ("AGI is coming")
- Culture-war framing
- Partisan commentary
- Sponsored editorial influence
- Investment/VC theater unless direct solo-builder implications exist
- Long summaries of announcements without practical impact
- Unsupported superlatives

---

## 5. Daily Issue Format

### Structure

```
═══════════════════════════════════════════
THE NIGHTLY LIBRARIAN
[Date] — Issue #[N]
═══════════════════════════════════════════

Brought to you by [Sponsor Product] — [one-sentence value prop].

─── THE 5 SIGNALS ─────────────────────────

1. [SIGNAL TITLE]
   [2-3 sentence summary of what happened]
   
   BUILDER IMPACT: [1-2 sentences on what this means 
   for a solo developer, specifically]
   
   Source: [primary source link]

2. [SIGNAL TITLE]
   ...

3. [SIGNAL TITLE]
   ...

4. [SIGNAL TITLE]
   ...

5. [SIGNAL TITLE]
   ...

─── TRY THIS ───────────────────────────────

[One concrete, testable thing the reader can try today.
Must include: what to do, expected time investment, 
and what they'll learn or gain.]

─── IGNORE THIS ────────────────────────────

[One thing that got attention today but is safe to skip.
Must explain WHY it's safe to ignore — not just "it's hype."]

─── LIBRARIAN'S VERDICT ────────────────────

[2-3 sentences. The editorial take on the day's AI 
landscape from the solo-builder perspective. Can be 
opinionated. Must be grounded.]

═══════════════════════════════════════════
The Nightly Librarian — thenightlylibrarian.com
Unsubscribe | Archive
═══════════════════════════════════════════
```

### Constraints

- **The 5 Signals**: Exactly 5. Not 4, not 6. Forces editorial discipline. If fewer than 5 genuinely qualify, fill remaining slots with "context signals" — things from earlier in the week that gained new relevance today. Mark these as `[CONTEXT]`.
- **Builder Impact**: Mandatory on every signal. The sentence must start with an action verb or a concrete noun. Never "This is interesting because..."
- **Try This**: Must be completable in under 2 hours. Must name a specific tool, API, or technique. No "explore the possibilities of..."
- **Ignore This**: Must name the specific claim or announcement being dismissed and provide a concrete reason.
- **Librarian's Verdict**: Maximum 3 sentences. No hedging. Take a position.
- **Sponsor line**: One line, top of issue only. Internal products first (CalenCall, Veremun, Pi).

---

## 6. Weekly Issue Format

Published Saturday morning. Synthesizes the week's daily issues.

### Structure

```
═══════════════════════════════════════════
THE NIGHTLY LIBRARIAN — WEEKLY DIGEST
Week of [Date Range]
═══════════════════════════════════════════

─── WHAT CHANGED THIS WEEK ─────────────────

[3-5 bullet points. Net-new facts about the AI landscape
that are different from last Friday.]

─── WHAT WAS ACTUALLY USEFUL ───────────────

[1-3 items from this week's daily issues that readers 
reported using, or that the editorial team verified 
as genuinely practical.]

─── WHAT WAS HYPE ──────────────────────────

[1-3 items that got outsized attention relative to 
their actual builder impact. Brief explanation of 
the gap between claim and reality.]

─── BEST THING TO TEST THIS WEEKEND ────────

[One item. More substantial than daily "Try This." 
Could be a 2-4 hour weekend project. Must be concrete 
with a clear deliverable.]

─── SOLO-DEV WORKFLOW UPGRADE ──────────────

[One specific workflow improvement a solo developer 
can adopt based on this week's developments. 
Must include before/after comparison.]

─── BUSINESS OPPORTUNITY ───────────────────

[One business opportunity created or newly viable 
due to this week's AI changes. Must be specific 
enough to validate in a weekend.]

─── WARNING / RISK TO WATCH ────────────────

[One risk, deprecation, pricing change, or stability 
concern that solo builders should monitor. 
Include timeline if known.]

═══════════════════════════════════════════
```

### Constraints

- Weekly issues do not repeat daily content verbatim — they synthesize.
- "What Was Actually Useful" requires evidence: reader feedback, personal testing, or community signal.
- "Business Opportunity" must pass the "could a solo dev start this Monday?" test.
- "Warning" must include a concrete action or monitoring step.

---

## 7. Source Strategy

### Tier 1: Primary Sources (checked every run)

| Source | Type | Signal |
|---|---|---|
| OpenAI blog/changelog | Official | Model releases, API changes, pricing |
| Anthropic blog/changelog | Official | Model releases, API changes, features |
| Google DeepMind / AI Studio blog | Official | Model releases, Gemini changes |
| Meta AI blog | Official | Open-source model releases |
| Mistral blog/changelog | Official | Model releases, API changes |
| GitHub blog/changelog | Official | Copilot changes, platform changes |
| Hugging Face blog | Community/Official | Open-source releases, benchmarks |
| Ollama releases | Official | Local model runtime changes |
| Vercel AI SDK changelog | Official | Framework changes |
| LangChain/LangGraph changelog | Official | Framework changes |

### Tier 2: Community Signal (checked every run, higher noise)

| Source | Type | Signal |
|---|---|---|
| Hacker News (AI-tagged) | Community | What builders are talking about |
| r/LocalLLaMA | Community | Open-source model sentiment |
| r/ChatGPT, r/ClaudeAI | Community | User-facing changes, bugs, pricing |
| AI-focused X/Twitter accounts (curated list) | Community | Breaking changes, outages |
| Product Hunt (AI category) | Community | New tool launches |

### Tier 3: Contextual Sources (checked weekly or on-demand)

| Source | Type | Signal |
|---|---|---|
| arxiv (cs.CL, cs.AI) | Research | Papers with near-term practical impact |
| AI benchmark leaderboards | Reference | Model capability shifts |
| Cloud provider pricing pages | Reference | Cost changes |
| StackOverflow trends (AI tags) | Community | Developer pain points |

### Source Rules

1. Every claim must trace to at least one Tier 1 or Tier 2 source.
2. Tier 3 sources provide context, not standalone signals.
3. No single-source stories unless the source is an official changelog or announcement.
4. X/Twitter posts are never sufficient as a sole source — they can trigger investigation but must be corroborated.
5. Press releases are treated as claims, not facts. The pipeline must find the underlying change (API diff, model card, benchmark, or code).
6. Source freshness: only items from the last 28 hours for daily issues (4-hour overlap buffer). Weekly issues may reference the full 7-day window.

---

## 8. Candidate Scoring Rubric

Every candidate item is scored on 9 dimensions, each 0–10.

| Dimension | Weight | 0 (low) | 10 (high) |
|---|---|---|---|
| **Solo-dev usefulness** | 3x | Enterprise-only; requires team | Directly usable by one person today |
| **Actionability** | 3x | Interesting but nothing to do | Clear next step a builder can take |
| **Urgency** | 2x | Relevant eventually | Relevant right now (breaking change, deprecation, window) |
| **Source credibility** | 2x | Single social media post, rumor | Official changelog, verified benchmark, multiple independent sources |
| **Hype risk** | 2x (inverted) | Massive hype, unverified claims | Grounded, evidence-backed, understated |
| **Cost impact** | 1x | No pricing relevance | Direct cost change for API users |
| **Production-readiness** | 1x | Research paper, "coming soon" | Available now, documented, stable |
| **Build opportunity** | 1x | No new capability unlocked | Enables a product/feature that wasn't possible before |
| **Workflow relevance** | 1x | Unrelated to solo-dev workflows | Directly improves a common solo-dev workflow |

### Scoring Formula

```
raw_score = (solo_dev_usefulness * 3) + (actionability * 3) + 
            (urgency * 2) + (source_credibility * 2) + 
            ((10 - hype_risk) * 2) + cost_impact + 
            production_readiness + build_opportunity + 
            workflow_relevance

max_possible = 160
normalized_score = (raw_score / max_possible) * 100
```

### Thresholds

| Score | Action |
|---|---|
| 70–100 | Strong candidate — include if space permits |
| 50–69 | Conditional — include only if fewer than 5 strong candidates |
| 30–49 | Weak — consider for "Ignore This" or weekly context |
| 0–29 | Drop — not relevant to target reader |

### Tiebreaker Rules

When candidates score equally:
1. Prefer the item with higher actionability
2. Prefer the item with lower hype risk
3. Prefer the item from the higher-tier source
4. Prefer the item with more immediate urgency

---

## 9. Content-Generation Pipeline

### Pipeline Stages

```
┌─────────────┐
│  SCHEDULE    │  Cron trigger: 2:00 AM ET daily
└──────┬──────┘
       │
┌──────▼──────┐
│  DISCOVER   │  Fetch from all Tier 1 + Tier 2 sources
│             │  Output: raw_items[]
└──────┬──────┘
       │
┌──────▼──────┐
│  EXTRACT    │  Parse each source into normalized candidates
│             │  Output: candidates[]
└──────┬──────┘
       │
┌──────▼──────┐
│  NORMALIZE  │  Deduplicate, merge related items, 
│             │  attach source references
│             │  Output: unique_candidates[]
└──────┬──────┘
       │
┌──────▼──────┐
│  SCORE      │  Apply 9-dimension rubric to each candidate
│             │  Output: scored_candidates[]
└──────┬──────┘
       │
┌──────▼──────┐
│  RANK       │  Sort by score, select top 5 signals + 
│             │  best Try This + best Ignore This
│             │  Output: selected_items{}
└──────┬──────┘
       │
┌──────▼──────┐
│  DRAFT      │  Generate issue text from selected items
│             │  Apply editorial voice and format constraints
│             │  Output: draft_issue
└──────┬──────┘
       │
┌──────▼──────┐
│  VERIFY     │  Run all verification gates (Section 10)
│             │  Output: pass/fail + violations[]
└──────┬──────┘
       │
┌──────▼───────────┐
│  REVIEW (opt.)   │  Human review gate (enabled for MVP)
│                  │  Output: approved / rejected + edits
└──────┬───────────┘
       │
┌──────▼──────┐
│  PUBLISH    │  Write final artifact, send to mailing list,
│             │  archive to storage
│             │  Output: published_issue
└──────┬──────┘
       │
┌──────▼──────┐
│  ARCHIVE    │  Store issue + metadata + scores + sources
│             │  in archive directory
└─────────────┘
```

### Stage Details

**DISCOVER**: Each source has an adapter that knows how to fetch the last 28 hours of content. Adapters return raw HTML/JSON/RSS. Failures are logged but do not block the pipeline — partial source coverage is acceptable. Minimum viable: at least 3 Tier 1 sources must return data for the run to proceed.

**EXTRACT**: Parse raw content into a common candidate schema:
```
{
  id: string (hash of source + title + date),
  title: string,
  summary: string,
  source_url: string,
  source_tier: 1 | 2 | 3,
  source_name: string,
  published_at: ISO8601,
  discovered_at: ISO8601,
  category: enum (see Section 7 categories),
  raw_claims: string[],
  entities: string[] (companies, models, tools mentioned)
}
```

**NORMALIZE**: Deduplicate by entity + category overlap. If two candidates refer to the same underlying event (e.g., "OpenAI releases GPT-5" from blog + HN + Reddit), merge into one candidate with multiple source references. Dedup key: normalized entity set + category + 24h time window.

**SCORE**: Apply the rubric from Section 8. Each dimension is scored by the LLM with a brief justification. Justifications are stored for audit.

**RANK**: Sort by normalized score descending. Select:
- Top 5 → The 5 Signals
- Highest-scoring item with actionability ≥ 8 → Try This
- Highest hype_risk item with solo_dev_usefulness ≤ 3 → Ignore This

**DRAFT**: Generate the issue using the format from Section 5. The LLM receives: selected items with scores and justifications, the editorial contract (Section 4), the format template, and the last 3 published issues (for voice consistency and dedup against recent content).

**VERIFY**: Run all gates from Section 10. Any BLOCKING gate failure halts publication. ADVISORY gate failures are logged but do not block.

**REVIEW**: For MVP, the draft is written to a review directory and a notification is sent. A human approves, edits, or rejects. This gate is optional and can be disabled once confidence in the pipeline is established.

**PUBLISH**: Send the approved issue to the mailing list provider API, write to the web archive, and update the issue index.

**ARCHIVE**: Store the complete pipeline run metadata: all candidates considered, scores, selections, draft iterations, gate results, and final published text.

---

## 10. Verification Gates

### Blocking Gates (must pass to publish)

| Gate ID | Check | Implementation |
|---|---|---|
| `VG-SOURCE` | Every signal has ≥1 source reference with a URL | Regex scan for `Source:` line with valid URL per signal |
| `VG-IMPACT` | Every signal has a `BUILDER IMPACT:` section | Regex scan for section presence + minimum 10 words |
| `VG-SPONSOR` | Sponsor text appears only in the allowed slot (first line after header) | Positional check: sponsor pattern must not appear after `THE 5 SIGNALS` header |
| `VG-POLITICS` | No political/culture-war framing | Keyword blocklist + LLM classification pass |
| `VG-ENTERPRISE` | No enterprise-only filler without solo-builder relevance | LLM classification: each signal must reference solo/indie/individual context |
| `VG-SUPERLATIVE` | No unsupported superlatives | Regex for "best," "revolutionary," "game-changing," "unprecedented" — each must have adjacent evidence clause |
| `VG-DEDUP` | No duplicate stories within the issue | Pairwise entity+category comparison across the 5 signals |
| `VG-STALE` | No stories outside the 28-hour window unless marked `[CONTEXT]` | Timestamp check on all source references |
| `VG-TRY-CONCRETE` | "Try This" must include a specific tool/API/technique name and a time estimate | Regex for named entity + time pattern (e.g., "30 minutes," "1 hour") |
| `VG-IGNORE-WHY` | "Ignore This" must include a reason clause | Minimum 15 words after the item name; must contain "because," "since," "the reason," or equivalent causal marker |
| `VG-COUNT` | Exactly 5 signals | Count check |
| `VG-FORMAT` | Issue matches the structural template | Section header presence check |

### Advisory Gates (logged, do not block)

| Gate ID | Check | Purpose |
|---|---|---|
| `AG-VOICE` | Tone consistency with previous 3 issues | LLM comparison — flags drift |
| `AG-LENGTH` | Total issue length between 800–2000 words | Ensures readability |
| `AG-DIVERSITY` | Signals cover ≥3 different categories | Prevents single-topic issues |
| `AG-FRESHNESS` | ≥3 of 5 signals are from the last 12 hours | Ensures timeliness |
| `AG-READING-LEVEL` | Flesch-Kincaid grade level 8–12 | Accessible but not dumbed down |

---

## 11. Data/Storage Model

### MVP: File-Based

No database for MVP. All state is stored in the filesystem under a single archive directory.

```
nightly-librarian/
├── SPEC.md                          # This document
├── SKILL.md                         # Existing internal job (separate)
├── config/
│   ├── sources.json                 # Source definitions + adapters
│   ├── scoring.json                 # Rubric weights and thresholds
│   ├── editorial.json               # Voice guidelines, blocklists
│   └── sponsors.json                # Sponsor rotation schedule
├── templates/
│   ├── daily.md                     # Daily issue template
│   └── weekly.md                    # Weekly issue template
├── pipeline/
│   ├── discover.ts                  # Source fetching
│   ├── extract.ts                   # Candidate extraction
│   ├── normalize.ts                 # Dedup + merge
│   ├── score.ts                     # Rubric application
│   ├── rank.ts                      # Selection logic
│   ├── draft.ts                     # Issue generation
│   ├── verify.ts                    # Gate checks
│   └── publish.ts                   # Mailing list + archive
├── adapters/
│   ├── rss.ts                       # Generic RSS adapter
│   ├── webpage.ts                   # Generic webpage scraper
│   ├── hackernews.ts                # HN API adapter
│   └── reddit.ts                    # Reddit API adapter
├── archive/
│   ├── issues/
│   │   ├── 2026-05-10.md            # Published issue
│   │   ├── 2026-05-10.json          # Full pipeline metadata
│   │   └── ...
│   ├── candidates/
│   │   ├── 2026-05-10-candidates.json  # All scored candidates
│   │   └── ...
│   └── weekly/
│       ├── 2026-W19.md              # Weekly digest
│       └── ...
├── review/
│   └── pending/                     # Drafts awaiting human review
└── logs/
    └── runs/                        # Pipeline run logs
```

### Candidate Record Schema

```json
{
  "id": "sha256-hash",
  "title": "string",
  "summary": "string",
  "source_url": "string",
  "source_tier": 1,
  "source_name": "string",
  "published_at": "2026-05-10T03:00:00Z",
  "discovered_at": "2026-05-10T06:00:00Z",
  "category": "model_release | api_change | tool_release | pricing_change | security_issue | workflow_pattern | business_opportunity | deprecation | outage | benchmark",
  "raw_claims": ["string"],
  "entities": ["string"],
  "scores": {
    "solo_dev_usefulness": 8,
    "actionability": 7,
    "urgency": 6,
    "source_credibility": 9,
    "hype_risk": 3,
    "cost_impact": 5,
    "production_readiness": 8,
    "build_opportunity": 6,
    "workflow_relevance": 7,
    "normalized_total": 74.3
  },
  "score_justifications": {
    "solo_dev_usefulness": "string",
    "...": "..."
  },
  "selected_as": "signal_1 | signal_2 | ... | try_this | ignore_this | null",
  "dedup_group": "string | null"
}
```

### Issue Record Schema

```json
{
  "issue_number": 1,
  "date": "2026-05-10",
  "type": "daily | weekly",
  "pipeline_run_id": "uuid",
  "candidates_considered": 42,
  "candidates_selected": 7,
  "gate_results": {
    "VG-SOURCE": { "passed": true },
    "VG-IMPACT": { "passed": true },
    "VG-SPONSOR": { "passed": true },
    "...": "..."
  },
  "advisory_flags": ["AG-DIVERSITY: only 2 categories represented"],
  "human_reviewed": true,
  "reviewer_edits": "string | null",
  "published_at": "2026-05-10T07:00:00Z",
  "sponsor": "CalenCall",
  "content_hash": "sha256"
}
```

### Future: Database Migration

When volume justifies it, migrate to Postgres (can share the existing Hetzner VPS). Schema maps directly from the JSON records above. The file-based MVP ensures zero infrastructure dependencies at launch.

---

## 12. Publishing Workflow

### Daily Flow

```
02:00 ET  — Pipeline runs (discover → archive)
~02:30 ET — Draft available in review/pending/
~03:00 ET — [MVP] Human reviews and approves
06:00 ET  — Issue publishes (email send + web archive)
```

### MVP Publishing Stack

| Component | Choice | Rationale |
|---|---|---|
| Mailing list | Buttondown (free tier) | Simple API, Markdown-native, free up to 100 subscribers, no tracking BS |
| Web archive | Static site (GitHub Pages or Cloudflare Pages) | Free, no server, version-controlled |
| Domain | thenightlylibrarian.com | Brand identity |
| Email send | Buttondown API or SMTP relay | Buttondown handles this |

### Alternative Considered

| Option | Rejected Because |
|---|---|
| Substack | Editorial independence concerns; platform lock-in |
| Ghost | Overkill for MVP; hosting cost |
| ConvertKit/Mailchimp | Feature bloat; expensive at scale |
| Self-hosted SMTP | Deliverability is a full-time job |

### Publish Steps

1. Pipeline generates `draft.md` in `review/pending/`
2. Human reviews (MVP) or auto-approve (post-MVP)
3. Approved draft is converted to Buttondown-compatible Markdown
4. Buttondown API call sends to subscriber list
5. Same content written to `archive/issues/YYYY-MM-DD.md`
6. Static site rebuilds from archive (GitHub Actions or Cloudflare Pages build hook)
7. Pipeline run metadata written to `archive/issues/YYYY-MM-DD.json`

---

## 13. Monetization Boundaries

### Allowed

- Single sponsor line at the top of each issue
- Internal products only for launch (CalenCall, Veremun, Pi)
- Future: curated external sponsors that pass editorial review
- Future: premium weekly deep-dives (paid tier — not in MVP)

### Prohibited

- Sponsored blurbs inside editorial body
- Paid placement in "Try This" or signal rankings
- Vendor influence over inclusion or exclusion decisions
- Affiliate links of any kind
- "Recommended by" badges that imply endorsement
- Revenue-sharing with sources
- Data selling (subscriber lists, engagement data)

### Sponsor Rotation (MVP)

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

Rotation is weighted random — higher weight = more frequent. All sponsors are internal during MVP.

---

## 14. MVP Build Phases

### Phase 0: Foundation (Days 1–2)

- Set up project directory structure
- Create source adapter framework (generic RSS + webpage)
- Implement 3 Tier 1 source adapters (OpenAI, Anthropic, HN)
- Create candidate schema and normalization logic
- Create scoring rubric implementation
- Write daily issue template

**Exit gate**: Can fetch, parse, and score candidates from 3 sources.

### Phase 1: Pipeline (Days 3–5)

- Implement full pipeline (discover → draft)
- Implement all 12 blocking verification gates
- Implement 5 advisory gates
- Add deduplication logic
- Add human review gate (write to review/pending/)
- Generate first test issue from real data

**Exit gate**: Full pipeline produces a verified draft from live sources.

### Phase 2: Publishing (Days 6–8)

- Set up Buttondown account and API integration
- Set up domain and static archive site
- Implement publish step (API send + archive write)
- Set up cron schedule (2 AM ET)
- Write first 3 real issues with human review

**Exit gate**: 3 issues published to test subscribers (internal list).

### Phase 3: Launch (Days 9–14)

- Publish 7 consecutive daily issues
- Gather feedback from 5–10 trusted readers
- Tune scoring weights based on feedback
- Publish first weekly digest
- Open subscriber registration
- Announce on personal channels

**Exit gate**: 7 daily issues + 1 weekly digest published. Subscriber signup live.

### Phase 4: Stabilize (Weeks 3–4)

- Add remaining Tier 1 source adapters
- Add Tier 2 source adapters (Reddit, X monitoring)
- Tune verification gates based on false positive/negative rate
- Consider removing human review gate
- Add source adapter health monitoring

**Exit gate**: Pipeline runs unattended for 7 consecutive days with ≤1 gate failure.

---

## 15. Non-Goals

These are explicitly out of scope for MVP and should not be designed, built, or proposed:

| Non-Goal | Reason |
|---|---|
| Generic newsletter business | This is a specific product for a specific audience |
| Enterprise reader optimization | Conflicts with solo-dev positioning |
| Paid tier | Free-first; monetize later with evidence of value |
| Large content CMS | File-based archive is sufficient for MVP |
| Affiliate marketing | Violates editorial contract |
| Political commentary | Violates editorial contract |
| Broad tech-news coverage | Dilutes the signal-to-noise promise |
| Subscriber analytics beyond basics | Premature optimization |
| Multi-author workflow | Solo operator for MVP |
| Mobile app | Email + web archive is sufficient |
| Comment system | Reader feedback via email reply or social |
| API for subscriber content | No programmatic access needed |
| A/B testing of subject lines | Premature optimization |
| Integration with existing Second Brain | Useful later, not required for MVP |

---

## 16. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Source APIs change or break | High | Medium | Multiple adapters per source category; graceful degradation; minimum 3-source threshold |
| LLM scoring inconsistency | Medium | High | Score justifications stored for audit; calibration set of 20 pre-scored candidates for regression testing |
| Pipeline fails silently | Medium | High | Health check after each stage; notification on failure; no-publish-on-error default |
| Hype content leaks through gates | Medium | Medium | Hype risk is 2x weighted in scoring; VG-SUPERLATIVE gate; human review for first 2 weeks |
| Burnout on daily human review | High | Medium | Design pipeline to be trustworthy enough to remove review gate within 2 weeks |
| Low subscriber growth | Medium | Low | Not a business risk for MVP — this is a content quality experiment first |
| Email deliverability issues | Low | High | Use established provider (Buttondown); monitor bounce rates; authenticate domain (SPF, DKIM, DMARC) |
| Duplicate content across days | Medium | Low | Cross-issue dedup: compare candidate entities against last 3 published issues |
| Source bias (over-indexing on one company) | Medium | Medium | AG-DIVERSITY advisory gate; entity frequency tracking across issues |
| LLM provider outage during pipeline | Low | High | Pipeline can retry 2x with 30-min backoff; manual fallback: human writes from scored candidates |

---

## 17. Recommended First 7-Day Launch Plan

### Day 1 (Monday): Foundation

- [ ] Initialize project directory structure
- [ ] Implement RSS adapter + OpenAI changelog adapter
- [ ] Implement candidate schema and extraction
- [ ] Test: fetch and parse 10+ candidates from OpenAI

### Day 2 (Tuesday): Scoring + More Sources

- [ ] Implement scoring rubric
- [ ] Add Anthropic changelog adapter
- [ ] Add Hacker News API adapter
- [ ] Test: score 20+ candidates, verify ranking makes sense

### Day 3 (Wednesday): Pipeline Assembly

- [ ] Wire discover → extract → normalize → score → rank
- [ ] Implement deduplication logic
- [ ] Implement draft generation with editorial voice
- [ ] Test: generate first complete draft issue from live data

### Day 4 (Thursday): Verification + Review

- [ ] Implement all 12 blocking verification gates
- [ ] Implement 5 advisory gates
- [ ] Set up human review directory and notification
- [ ] Test: run full pipeline, review gate results, fix false positives

### Day 5 (Friday): Publishing Stack

- [ ] Set up Buttondown account
- [ ] Set up domain + static archive site
- [ ] Implement publish step (API + archive)
- [ ] Test: publish Issue #0 to internal test list

### Day 6 (Saturday): First Real Issue

- [ ] Run full pipeline against live data
- [ ] Human review and edit
- [ ] Publish Issue #1 to test subscribers
- [ ] Write first weekly digest template
- [ ] Gather feedback from 3 trusted readers

### Day 7 (Sunday): Iterate + Schedule

- [ ] Tune scoring weights based on Day 6 feedback
- [ ] Fix any gate false positives/negatives
- [ ] Set up cron schedule for 2 AM ET daily runs
- [ ] Publish Issue #2
- [ ] Document operational runbook for pipeline monitoring

---

## Appendix A: Information Categories

The pipeline tracks these categories for classification and diversity:

| Category | Code | Examples |
|---|---|---|
| Model changes | `model_release` | New model versions, capability upgrades, deprecations |
| API/platform changes | `api_change` | New endpoints, SDK updates, breaking changes |
| AI coding agent changes | `tool_release` | Copilot updates, Cursor changes, Claude Code updates |
| Open-source releases | `tool_release` | New OS models, frameworks, libraries |
| Model pricing/cost changes | `pricing_change` | Token price changes, free tier adjustments |
| Deployment/runtime changes | `tool_release` | Ollama updates, vLLM changes, inference platforms |
| Security/risk/outage | `security_issue` | Vulnerabilities, data incidents, service outages |
| Workflow patterns | `workflow_pattern` | New techniques, prompt patterns, integration approaches |
| Business opportunities | `business_opportunity` | New capabilities enabling solo-dev products |
| Safe to ignore | `ignore` | Overhyped announcements, enterprise-only features |
| Deprecation | `deprecation` | End-of-life notices, migration requirements |
| Benchmark results | `benchmark` | Leaderboard changes, capability comparisons |

---

## Appendix B: Sponsor Slot Specification

The sponsor slot is structurally enforced:

```
Position:    First line after the issue header
Format:      "Brought to you by [Name] — [tagline]."
Max length:  120 characters total
Frequency:   Every issue
Content:     Product name + one-sentence value proposition
Prohibited:  CTA buttons, links beyond product URL, 
             multi-line copy, promotional language 
             ("amazing," "incredible," "#1")
```

No other sponsorship positions exist in the format. This is the only monetization surface in the editorial product.
