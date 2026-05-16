# Slice 1 Runtime Reconciliation

Date: 2026-05-14
Branch: `codex/collapsed-triage-plan`
Scope: evidence only; no runtime source changes, migrations, dependency changes, cron changes, or fetcher changes.

## Decision

Slice 2 should target the PostgreSQL-backed runtime deployed at `/opt/nightly-librarian`, not the archive-only Bun pipeline currently present in this local checkout.

The local repo is useful for editorial rules, tests, and prior archive pipeline behavior, but it is not the production fetch path. The deployed runtime is a separate Node/CommonJS app, is not a git checkout, and is currently the only code path writing `sources`, `raw_items`, `nightly_runs`, and `fetch_log`.

## Evidence

Local repo:

- Repo root: `/Users/fuzzypi/nightly-librarian`
- Branch: `codex/collapsed-triage-plan`
- Package scripts: `nightly:fetch`, `nightly:score`, `nightly:draft`, `nightly:verify`, `nightly:run`, `nightly:inspect`
- Runtime path: `src/index.ts` -> archive files under `archive/runs`
- No local `pg`, `DATABASE_URL`, DB module, migrations, or table-backed fetch/runtime code found.

Deployed VPS:

- Path: `/opt/nightly-librarian`
- Not a git repository.
- Package scripts: `fetch`, `test-source`, `test-all`
- Dependencies include `pg`, `dotenv`, `rss-parser`, and `cheerio`.
- DB module: `src/db.js`
- Runner/cron entrypoint: cron runs `cd /opt/nightly-librarian && /usr/bin/node src/index.js` at 08:00 UTC.
- Fetch path: `src/index.js` -> `src/runner.js` -> `src/fetchers/{rss,github-release,hn-api,reddit-json,scraper}.js`
- Fetch writes `nightly_runs`, `fetch_log`, `raw_items`, and updates `sources`.

Live schema:

- `raw_items` has `id`, `source_id`, `external_id`, `title`, `url`, `content`, `raw_data`, `fetched_at`, `published_at`, `processed boolean`, `duplicate_of`, `created_at`.
- `candidates` exists but has no rows. It uses `raw_item_ids uuid[]` and `source_ids text[]`; it does not have `run_id` or scalar `raw_item_id`.
- `nightly_runs` has fetch and future-stage counters plus `private_memo` and `public_brief`; it does not have `memo_markdown`.
- `sources` and `fetch_log` are active and populated.

Required plan fields missing from live schema:

- `raw_items.processed_at`
- `raw_items.processed_run_id`
- `raw_items.processing_run_id`
- `raw_items.processing_started_at`
- `raw_items.processing_status`
- `raw_items.processing_error`
- `nightly_runs.memo_markdown`
- `nightly_runs.claimed_item_count`
- `nightly_runs.deferred_item_count`

## Slice 2 Recommendation

1. Reconcile the deployed DB-backed runtime into version control before implementing Claude-backed triage. Either port the deployed CommonJS app into this repo or deliberately replace the local archive pipeline with a DB-backed TypeScript equivalent.
2. Add a narrow migration before the triage job. At minimum, add the missing raw item processing/claim fields and the missing run count fields. Decide whether to use existing `private_memo` or migrate to `memo_markdown`; do not silently write both without a compatibility reason.
3. Align candidate ownership with the live schema. The plan's `candidates(raw_item_id, run_id)` contract conflicts with the live `raw_item_ids uuid[]` table. Slice 2 should either migrate to scalar per-raw-item candidates with `run_id`, or intentionally keep grouped candidates and add explicit run linkage.
4. Wire the next job beside the deployed runner path, with an exact CLI/cron-compatible entrypoint. The current production entrypoint is `node src/index.js`; local package scripts are not production wiring.
5. Keep fetchers unchanged. Consume eligible rows from `raw_items` and persist triage/editorial state transactionally.
