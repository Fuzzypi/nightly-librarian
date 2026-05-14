# Collapsed Triage + Evidence + Editor MVP

**Date**: 2026-05-14
**Status**: Implementation-ready plan
**Target repo**: `/Users/fuzzypi/nightly-librarian`
**Execution mode**: SINGLE_AGENT

## Goal Intake

Build one nightly MVP job that collapses Triage, Evidence, and Editor into a single Claude-backed editorial pass.

The job must:

1. Query unprocessed `raw_items` from the last 24 hours.
2. Send a bounded batch to Claude with the Nightly Librarian scoring criteria and editorial rules.
3. Write scored candidates to `candidates`.
4. Generate a private memo and store it in `nightly_runs`.
5. Mark the processed raw items so they are not reprocessed on the next run.

Non-goals:

- Do not split Triage, Evidence, and Editor into separate agents yet.
- Do not publish a public brief.
- Do not build subscriber/email delivery.
- Do not solve broken source ingestion, Reddit blocking, or scraper selector gaps in this pass.
- Do not replace deterministic verify gates.

Completion boundary:

- A real command runs against a test or live database, creates a `nightly_runs` row, inserts `candidates`, marks `raw_items` processed, and leaves enough audit data to explain why every selected item was or was not worth mentioning.

## Current-State Brief

Internal reality:

- This checkout currently has a Bun + TypeScript archive-based pipeline:
  - CLI entrypoint: `src/index.ts`
  - fetch path: `fetchAllSources` -> `extractItems` -> `normalizeItems` -> `deduplicateCandidates`
  - scoring path: `scoreCandidates` in `src/pipeline/score.ts`
  - selection path: `selectCandidates` in `src/pipeline/select.ts`
  - memo path: `generateMemo` in `src/pipeline/memo.ts`
  - archive path: `writeArchive` in `src/pipeline/archive.ts`
- The local code does not currently contain a PostgreSQL client, database module, migrations, or table-backed runtime path.
- The Second Brain says the deployed VPS version has a PostgreSQL-backed fetch layer with `sources`, `raw_items`, `candidates`, `nightly_runs`, and `fetch_log`, and 1701 `raw_items` from 19/21 working sources.
- The local checkout and deployed VPS state are therefore not fully synchronized. The implementation agent must inspect or pull the deployed code/schema before editing if this local checkout is stale.
- Existing editorial guardrails live in `config/editorial.json`, `config/scoring.json`, `SPEC.md`, `VERIFY-CHECKLIST.md`, and gate implementations under `src/gates/`.
- Existing unresolved project issues include source fetch quality and residual public brief polish. Those are adjacent risks, not blockers for the private memo MVP.

External API reality:

- Anthropic's current Messages API supports stateless message creation through `POST /v1/messages`.
- Anthropic's official TypeScript SDK supports Node.js, Deno, Bun, and browser usage.
- Claude structured outputs are available through `output_config.format` with JSON Schema, which is the right shape for scoring candidates and memo sections without brittle JSON parsing.

## Preliminary Realization Frame

Likely architecture layer:

- Add a DB-backed editorial job beside the fetch runner, not inside the fetchers.
- Keep fetch, source health, and raw item persistence separate from Claude scoring/editorial synthesis.

Likely runtime path:

`cron` -> `bun run src/index.js triage` or `bun run src/jobs/nightly-triage.js` -> DB query for eligible `raw_items` -> Claude structured-output call -> transaction inserts `candidates`, inserts/updates `nightly_runs`, marks `raw_items` processed.

Likely integration points:

- DB access module from deployed fetch layer, or new `src/db.js`/`src/db.ts` if absent locally.
- Existing config files for scoring/editorial rules.
- Existing memo concepts from `src/pipeline/memo.ts`.
- Existing deterministic gates later, but not as a blocking public-publish step for this private memo job.

Proof required:

- Unit proof for prompt packing, Claude response validation, and candidate persistence mapping.
- Integration proof against a test database transaction.
- Smoke proof against real recent `raw_items` if credentials and VPS access are available.
- Idempotency proof that rerunning does not duplicate candidates or reprocess already processed raw items.

## Research Decision Gate

Proven-path research: RUN.

Reason: Claude API integration and structured output parameters are version-sensitive. Expected value is avoiding a brittle prompt-only JSON contract. Risk of skipping is malformed output handling or SDK mismatch.

Innovation research: SKIP.

Reason: MVP needs one reliable nightly job. Managed agents, multi-agent orchestration, and clever workflow designs add scope before the private memo proves value.

## Realization Filter

Accepted approach:

- One DB-backed job with one Claude call per bounded batch.
- Use structured outputs with a strict JSON schema for candidates and memo.
- Wrap DB writes and raw item marking in one transaction.
- Store Claude request metadata and normalized response for audit.

Rejected approaches:

- Three separate agent passes for Triage, Evidence, and Editor. Too much orchestration for MVP.
- LLM-only freeform markdown generation with no structured candidate rows. It cannot reliably populate `candidates`.
- Archive-only implementation that writes files but never touches `raw_items`, `candidates`, or `nightly_runs`. That would bypass the requested runtime path.
- Public brief generation in this pass. The request is private memo first.

## Synthesis Brief

The right MVP is a database-first editorial job that uses Claude as a scoring and memo synthesis engine while preserving deterministic local ownership of state. Fetch remains responsible for raw inventory. The collapsed desk consumes only unprocessed recent raw items, asks Claude for strict JSON with item-level decisions, then persists the result transactionally.

The main implementation risk is repo-state drift: the local checkout has the old archive-based pipeline, while the deployed system appears to already have PostgreSQL modules. The implementation agent should first reconcile the deployed code/schema into the working tree or directly inspect the VPS path before editing.

## Skill Selection Declaration

Primary skill: `implementation-planner:spec-plan`.

Complementary checks applied inline:

- Repo reality research via local source inspection.
- Connectivity/runtime preflight by mapping the command, DB transaction, and cron path.
- API/interface design by defining the Claude output schema and DB ownership boundary.

## Architecture + Realization Contract

### Architecture Fit

Owned layer:

- Background editorial job / pipeline layer.

Allowed modules:

- `src/index.*` or CLI router.
- `src/jobs/nightly-triage.*` or `src/pipeline/triage.*`.
- Existing or new DB module.
- Config loading for scoring/editorial rules.
- Tests under `test/`.

Forbidden in this pass:

- Fetcher rewrites except adapting imports.
- Public publishing.
- Sponsor rotation changes.
- Verify gate rewrites unless needed to keep existing tests passing.

Architecture decision note required:

- Yes. This introduces the first Claude-backed DB editorial boundary and changes candidate ownership from deterministic local score-only logic to LLM-assisted scoring with persisted audit fields.

### Runtime Wiring Path

Required runtime path:

`raw_items` rows with `processed_at IS NULL` and `published_at/discovered_at >= run_started_at - interval '24 hours'` must be reachable through the new nightly command. The 24-hour predicate defines the run's initial eligibility snapshot, not a reason to drop unprocessed rows after they have been claimed for that run.

Required entrypoint:

- Add a CLI command such as `triage` or `nightly:memo` and wire it in `package.json`.

Disconnected implementation would be:

- A standalone script that only reads JSON fixtures.
- A Claude helper that is never called by the nightly command.
- Candidate insertion without marking source rows processed.

### State/Data Ownership

Data enters:

- `raw_items`.

Data transforms:

- The job creates a `nightly_runs` row first, then claims eligible `raw_items` before calling Claude.
- Claimed rows are selected with row-locking semantics such as `FOR UPDATE SKIP LOCKED`, or an equivalent compare-and-set claim update, so concurrent runs cannot process the same rows.
- Batch packing sanitizes title/content/source metadata.
- Claude returns structured scored candidate decisions and memo sections.
- Local code validates and maps Claude output to DB rows.

Data persists:

- `candidates` owns item-level scored editorial decisions.
- `nightly_runs` owns run metadata, memo body, Claude usage metadata, source counts, and any error state.
- `raw_items` owns processing state.

### Test-Level Selection

Required proof:

- Unit: prompt schema, response parser, row mapping.
- Integration: transaction claims raw items, inserts candidates and nightly run, then marks raw items processed.
- Negative: malformed Claude output is rejected and leaves raw items unprocessed.
- Idempotency/concurrency: rerun does not duplicate candidates for already processed raw items, and concurrent runs cannot claim the same unprocessed rows.
- Backlog drain: a run with more eligible rows than `TRIAGE_BATCH_LIMIT` processes them in bounded pages or records the unprocessed claimed rows as deferred for a later continuation.
- Smoke: real command works with at least fixture/test rows.

### Usage Proof

Minimum READY evidence:

- Command output showing selected raw item count, candidate insert count, run id, and processed item count.
- SQL verification showing matching `nightly_runs` and `candidates` rows.
- SQL verification showing processed raw item ids now have `processed_at`.
- SQL verification showing no eligible claimed rows were silently abandoned because of the batch page limit.
- Test output from `bun run typecheck` and `bun test`.

### No-Orphan-Code Check

Prevent unused code by:

- Wiring the job into `package.json`.
- Calling the new job from the real CLI entrypoint.
- Adding tests that invoke the exported job function.
- Keeping all DB writes behind the same production DB module.

### Definition of Done

The implementation agent may claim READY only when the command reaches the DB-backed runtime path, uses Claude structured output or an equivalent validated schema, persists candidates and memo, marks raw rows processed transactionally, and passes the Verify Gate below.

## Proposed Data Contract

If the deployed schema already has these columns, use them. If not, add the narrowest migration.

`raw_items` processing fields:

- `processed_at timestamptz null`
- `processed_run_id uuid null references nightly_runs(id)`
- `processing_run_id uuid null references nightly_runs(id)`
- `processing_started_at timestamptz null`
- `processing_status text null`
- Optional `processing_error text null`

`candidates` minimum fields:

- `id uuid primary key`
- `run_id uuid references nightly_runs(id)`
- `raw_item_id uuid references raw_items(id)`
- `source_id text`
- `title text`
- `source_url text`
- `published_at timestamptz`
- `score numeric`
- `worth_mentioning boolean`
- `category text`
- `evidence_level text`
- `summary text`
- `builder_impact text`
- `rationale text`
- `risks jsonb`
- `created_at timestamptz default now()`

`nightly_runs` minimum new/used fields:

- `id uuid primary key`
- `run_type text` with value `triage_editor_mvp`
- `started_at timestamptz`
- `completed_at timestamptz null`
- `status text`
- `raw_item_count integer`
- `candidate_count integer`
- `claimed_item_count integer`
- `deferred_item_count integer`
- `memo_markdown text`
- `model text`
- `prompt_version text`
- `usage jsonb`
- `error text null`

Uniqueness:

- Add or enforce a unique key on `candidates(raw_item_id, run_id)` or `candidates(raw_item_id)` depending on whether one raw item may be reconsidered in future editorial passes.
- For MVP, prefer one candidate per raw item and use `candidates(raw_item_id)` unique.

## Claude Output Schema

Return one JSON object:

```json
{
  "run_summary": {
    "headline": "string",
    "raw_item_count": 0,
    "worth_mentioning_count": 0,
    "memo_markdown": "string"
  },
  "candidates": [
    {
      "raw_item_id": "string",
      "worth_mentioning": true,
      "score": 0,
      "category": "model_release",
      "evidence_level": "official_changelog",
      "summary": "string",
      "builder_impact": "string",
      "rationale": "string",
      "risks": ["string"]
    }
  ]
}
```

Validation rules:

- Every returned `raw_item_id` must match an input item id.
- Score must be 0-100.
- `worth_mentioning` must be false for low-evidence hype with no direct solo-dev impact.
- `builder_impact` is required when `worth_mentioning` is true.
- Unknown categories or evidence levels fail validation.
- Missing items fail the run unless explicitly listed as rejected candidates.
- Claude responses are validated only against the rows in the current claimed page. The run-level code owns page iteration and must not ask Claude to reason about rows omitted because of page size.

## Implementation Plan

### Phase 0: Reconcile Runtime Reality

1. Inspect the actual deployed code at `/opt/nightly-librarian/` or pull the latest source of truth.
2. Dump or inspect table definitions for `raw_items`, `candidates`, and `nightly_runs`.
3. Decide whether local archive pipeline is obsolete, still used for tests, or must be merged with the deployed DB-backed code.

Deliverable:

- Short architecture decision note in the implementation PR or commit message.

### Phase 1: Add Claude Client Boundary

1. Add `@anthropic-ai/sdk`.
2. Add `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `TRIAGE_BATCH_LIMIT`, and optional `CLAUDE_MAX_TOKENS` config.
3. Implement `createEditorialPass(input)` with:
   - bounded input packing
   - stable system prompt from editorial/scoring config
   - JSON Schema structured output
   - retry only for transient API failures
   - no retry for schema-invalid output until logged

Deliverable:

- Unit tests for schema validation and malformed output handling.

### Phase 2: Add DB Query + Transaction

1. Insert a `nightly_runs` row with `status='running'` and capture `run_started_at`.
2. Claim the run's eligible raw rows before any Claude call:
   - unprocessed deferred rows from prior runs first, regardless of age
   - then unprocessed fresh rows discovered or published in the 24 hours before `run_started_at`
   - not currently claimed by another active run, or claimed by a stale failed/abandoned run older than the configured recovery window
   - has non-empty title/content/url
   - deterministic order by source tier, published time, discovered time
   - use `FOR UPDATE SKIP LOCKED` or an equivalent atomic claim update
   - set `processing_run_id`, `processing_started_at`, and `processing_status='claimed'`
3. Process claimed rows in pages where `TRIAGE_BATCH_LIMIT` is the page size, not the maximum run size.
4. For each claimed page:
   - call Claude only with that page
   - validate the structured response against that page's raw item ids
   - in one transaction, insert candidate rows and mark that page's raw items `processed_at`, `processed_run_id`, and `processing_status='processed'`
5. After all claimed pages are processed, store memo and aggregate usage metadata on `nightly_runs`, set final counts, and set run `status='completed'`.
6. If max runtime or API budget prevents finishing all claimed pages:
   - keep unfinished claimed rows with `processing_status='deferred'`
   - increment `nightly_runs.deferred_item_count`
   - make the next run pick up deferred rows before claiming fresh rows
   - do not let deferred rows age out because they are older than 24 hours
7. On failure:
   - set run `status='failed'` if a run row exists
   - do not mark unfinished raw items processed
   - release claims or mark them stale-recoverable so a later run can retry them

Deliverable:

- Integration test with seeded raw rows.
- Concurrency/idempotency test proving two simultaneous runs cannot process the same raw item.
- Backlog test proving more eligible rows than `TRIAGE_BATCH_LIMIT` are drained in multiple pages or explicitly deferred.

### Phase 3: Wire CLI + Cron Path

1. Add command:
   - `bun run src/index.ts triage` or `bun run src/jobs/nightly-triage.ts`
2. Add package script:
   - `nightly:triage`
3. Update server cron only after smoke testing manually.
4. Keep existing fetch cron intact.

Deliverable:

- Manual command evidence from local/test DB and, if available, VPS.

### Phase 4: Memo Quality Pass

1. Ensure private memo includes:
   - source health summary
   - raw item inventory
   - worth mentioning candidates
   - rejected/high-hype items
   - uncertainty notes
   - failed/empty source caveats
2. Store memo in `nightly_runs.memo_markdown`.
3. Optionally write a local copy under archive only as a secondary artifact, not the source of truth.

Deliverable:

- Example memo from seeded or live data.

## Wiring Map

| Work item | New/changed code | Must be wired into | Runtime proof | Test proof |
|---|---|---|---|---|
| Claude editorial pass | `src/pipeline/triage-editor.*` or equivalent | Nightly triage command | command logs model, run id, candidate count | mocked Claude schema tests |
| Raw item query | DB repository/module | Real `raw_items` table | SQL shows unprocessed rows selected | integration seeded rows |
| Raw item claim | DB transaction with row locks or atomic claim update | Real `raw_items` processing fields | SQL shows claimed rows have one `processing_run_id` before Claude call | concurrency/idempotency test |
| Candidate persistence | DB transaction | Real `candidates` table | SQL shows inserted scored candidates | transaction test |
| Memo persistence | DB transaction | Real `nightly_runs` table | SQL shows `memo_markdown` on completed run | integration assertion |
| Processed marking | DB transaction | Real `raw_items` table | SQL shows `processed_at` and `processed_run_id` | idempotency test |
| Backlog paging | Claimed-row page loop | `TRIAGE_BATCH_LIMIT` as page size only | SQL shows all claimed rows processed or deferred | over-limit backlog test |
| CLI script | `src/index.*`, `package.json` | Cron/manual runtime | `bun run nightly:triage` succeeds | smoke command |

## Verify Gate

Automated checks:

```bash
bun run typecheck
bun test
bun run nightly:triage -- --dry-run
bun run nightly:triage -- --limit 5
```

Database evidence:

```sql
select id, status, raw_item_count, candidate_count, model
from nightly_runs
order by started_at desc
limit 1;

select count(*)
from candidates
where run_id = '<latest_run_id>';

select count(*)
from raw_items
where processed_run_id = '<latest_run_id>'
  and processed_at is not null;

select processing_status, count(*)
from raw_items
where processing_run_id = '<latest_run_id>'
group by processing_status;
```

PASS criteria:

- Typecheck passes.
- Tests pass.
- Dry run does not write DB state.
- Live/test limited run writes one completed `nightly_runs` row.
- Candidate count matches persisted candidate rows.
- Processed raw item count matches the intended input rows.
- Re-running immediately does not duplicate candidate rows.
- A seeded over-limit run proves `TRIAGE_BATCH_LIMIT` pages through all eligible rows or records unfinished rows as deferred.
- A concurrent-run test proves two runs cannot claim or process the same raw item.

FAIL criteria:

- Claude output can be malformed without failing the run.
- Candidates are inserted but raw items are not marked processed.
- Raw items are marked processed before candidate/memo persistence succeeds.
- Raw items are sent to Claude before they are claimed/locked for the current run.
- Rows omitted by `TRIAGE_BATCH_LIMIT` can age out of future runs without being processed or explicitly deferred.
- The memo exists only as a file and not in `nightly_runs`.
- The command is not reachable through a package script or cron-compatible entrypoint.

Forbidden shortcuts:

- Do not mark all 24h items processed if only a subset was sent to Claude.
- Do not treat `TRIAGE_BATCH_LIMIT` as a total run cap; it is a page size. If the run stops early, record deferred rows and keep them eligible.
- Do not silently truncate Claude input without processing or deferring omitted rows.
- Do not write candidates from freeform markdown parsing.
- Do not hard-code a Claude model; require config with a sane default only if the project already uses one.

## Manual Test Script

READY-only:

1. Seed or identify 5-20 unprocessed `raw_items` from the last 24 hours.
2. Run `bun run nightly:triage -- --limit 10`.
3. Open the latest `nightly_runs.memo_markdown`.
4. Confirm the memo answers: what is worth mentioning to a serious solo developer, and why?
5. Confirm rejected items are not framed as a public ignore pile.

## Implementation-Agent Handoff Prompt

You are implementing the collapsed Triage + Evidence + Editor MVP in `/Users/fuzzypi/nightly-librarian`.

Build one DB-backed nightly job that reads unprocessed `raw_items` from the last 24 hours, sends them to Claude with the Nightly Librarian scoring/editorial rules, writes scored rows to `candidates`, stores a private memo in `nightly_runs`, and marks only those raw items processed.

Before editing, reconcile repo reality. The local checkout currently has a Bun/TypeScript archive pipeline, but the Second Brain says the deployed VPS at `/opt/nightly-librarian/` has PostgreSQL-backed fetch code and tables. Inspect the real schema/code and work on the actual runtime path. Do not create an archive-only parallel path.

Use Anthropic structured outputs or an equivalent strict JSON schema. Validate the response locally before DB writes. Claim raw items before calling Claude, using `FOR UPDATE SKIP LOCKED` or an equivalent atomic claim update so concurrent runs cannot process the same rows. Treat `TRIAGE_BATCH_LIMIT` as page size, not a total run cap: drain all claimed pages, or mark unfinished claimed rows deferred and keep them eligible for continuation. Wrap candidate inserts, memo persistence, and raw item processed marking in transactions. On failure, unfinished raw items must remain unprocessed and retryable.

Likely files/modules:

- `src/index.*`
- `package.json`
- existing/new DB module
- new `src/pipeline/triage-editor.*` or `src/jobs/nightly-triage.*`
- tests under `test/`
- optional migration file if schema fields are missing

Do not:

- Split this into three agents.
- Publish a public brief.
- Rewrite fetchers as part of this task.
- Solve broken sources unless schema inspection requires a tiny compatibility fix.
- Claim READY because a helper function exists. The real command must write the DB-backed runtime path.

Run and report:

- `bun run typecheck`
- `bun test`
- `bun run nightly:triage -- --dry-run`
- `bun run nightly:triage -- --limit 5`
- SQL evidence for latest `nightly_runs`, matching `candidates`, and processed `raw_items`.
- SQL evidence for claimed/deferred raw item statuses and an over-limit paging/concurrency proof.

READY is forbidden until the Verify Gate passes legitimately.

## Unresolved Risks

- Local checkout may lag deployed PostgreSQL fetch code.
- Actual table schemas are not present in this checkout.
- Claude API key/model may exist only on the VPS.
- Existing source quality issues may produce thin memos until fetch gaps are fixed.
- Large raw item batches can exceed context or cost limits; MVP needs a conservative page size and deferred-count logging.
- Row claims need stale-run recovery; otherwise a crashed run can strand `raw_items` in `processing_status='claimed'`.

## Source Links

- Anthropic Messages API: https://platform.claude.com/docs/en/api/messages.md
- Anthropic structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md
- Anthropic client SDKs: https://docs.anthropic.com/en/api/client-sdks
