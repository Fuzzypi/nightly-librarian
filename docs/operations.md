# Operations

## Daily Baseline

1. Upstream Nightly Librarian produces a digest artifact.
2. Distribution tooling verifies artifact status and date.
3. Social/static generation runs in dry-run or draft mode.
4. A human or explicit policy gate reviews output.
5. Approved drafts may be copied manually or used by future posting tools.

## Current Safe Commands

```bash
npm run verify
mkdir -p artifacts/upstream
npm run triage:export -- --run-id RUN_ID --date YYYY-MM-DD > artifacts/upstream/YYYY-MM-DD.producer.json
npm run digest:import -- --date YYYY-MM-DD --source path/to/upstream.json --dry-run
npm run social:generate -- --date YYYY-MM-DD --dry-run
npm run approval:create -- --date YYYY-MM-DD --digest artifacts/digests/YYYY-MM-DD.json --approval artifacts/approvals/YYYY-MM-DD.json --approver "Name" --approved-at YYYY-MM-DDTHH:MM:SS.sssZ
npm run approval:validate -- --date YYYY-MM-DD --digest artifacts/digests/YYYY-MM-DD.json --approval artifacts/approvals/YYYY-MM-DD.json
npm run build:site
npm run publish:check
```

`triage:export` reads an existing completed producer run through the current triage/report path and writes structured JSON to stdout. It preserves the markdown `triage:report` command, rejects non-completed runs, and does not post publicly. Run it only in an environment already authorized to read the producer run data; verification can use committed fixtures instead of production data.

`digest:import` reads one explicit local upstream JSON artifact and normalizes it into `artifacts/digests/YYYY-MM-DD.json`. It does not discover production paths, connect to databases, read credentials, or call the network.

`social:generate` reads a completed local digest artifact and writes draft artifacts under `dist/`. It does not post, create paid-service dependencies, read credentials, or call the network.

`approval:create` and `approval:validate` create or validate explicit local approval state under `artifacts/approvals/`. Approval validation computes the deterministic draft hashes in memory from the digest, so it can validate what `social:generate --dry-run` would produce without writing `dist/`.

`build-site` injects the Cloudflare Web Analytics beacon on every generated page when `CF_WEB_ANALYTICS_TOKEN` is set in the environment or `.env.template`. Without the token, the beacon is omitted and local builds remain unchanged.

For the measurement rollout and weekly reporting format, see [docs/measurement.md](./measurement.md).

`publish:check` is a local-only preflight for the generated static site. Run it after `npm run build:site`; it checks that the latest generated brief/report have matching site pages, the site index/feed/sitemap exist, and the latest brief page has a meaningful lead summary. It does not browse the live site or call the network.

After deployment, verify the live site with the approved browser CLI:

```bash
latest="$(find dist/briefs -maxdepth 1 -name '????-??-??.md' -print | sed -E 's#^.*/([0-9-]+)\.md#\1#' | sort | tail -1)"
~/.claude/skills/gstack/browse/dist/browse goto "https://thenightlylibrarian.com/"
~/.claude/skills/gstack/browse/dist/browse wait --load
~/.claude/skills/gstack/browse/dist/browse text
~/.claude/skills/gstack/browse/dist/browse goto "https://thenightlylibrarian.com/briefs/${latest}/"
~/.claude/skills/gstack/browse/dist/browse wait --load
~/.claude/skills/gstack/browse/dist/browse text
~/.claude/skills/gstack/browse/dist/browse console --errors
```

## Producer Export Round Trip

The safe local round trip is:

```bash
npm run digest:import -- --date YYYY-MM-DD --source artifacts/upstream/YYYY-MM-DD.producer.json
npm run social:generate -- --date YYYY-MM-DD --input artifacts/digests/YYYY-MM-DD.json --dry-run
npm run approval:create -- --date YYYY-MM-DD --digest artifacts/digests/YYYY-MM-DD.json --approval artifacts/approvals/YYYY-MM-DD.json --approver "Name" --approved-at YYYY-MM-DDTHH:MM:SS.sssZ
npm run approval:validate -- --date YYYY-MM-DD --digest artifacts/digests/YYYY-MM-DD.json --approval artifacts/approvals/YYYY-MM-DD.json
```

`social:generate --dry-run` must not write `dist/` and must not publish anything. `approval:validate` must fail closed when approval is missing, stale, malformed, date-mismatched, or bound to different digest/social hashes.

To create an approval artifact locally, pass an explicit approver and approval time:

```bash
npm run approval:create -- \
  --date YYYY-MM-DD \
  --digest artifacts/digests/YYYY-MM-DD.json \
  --approval artifacts/approvals/YYYY-MM-DD.json \
  --approver "Name" \
  --approved-at YYYY-MM-DDTHH:MM:SS.sssZ
```

`approval:create` does not infer the current time. The approval timestamp is explicit so artifacts remain reviewable and repeatable.

## Secrets

Secrets belong in the runtime environment, not this repo.

Never commit:

- `.env`
- real API keys or tokens
- OAuth credentials
- cookies or browser profiles
- service account JSON
- production database URLs

Use `.env.template` for placeholders only.

## Generated Artifacts

Generated social drafts, transient logs, and completion JSON are output, not source. `dist/` remains generated output. The deliberate exceptions are:

- `reports/YYYY-MM-DD.md` - tracked daily report markdown used as a public-site source input
- `archive/runs/**/brief.md` - selected legacy archive briefs preserved as public-site source inputs

Raw run JSON, candidate dumps, approvals, synthesized artifacts, and other machine byproducts remain untracked unless explicitly promoted.

## Incident Handling

If a digest is missing, failed, partial, stale, or untrusted:

- do not publish normal social output
- do not import markdown-only reports as if they contained source facts
- do not treat missing approval as approval
- label fallback output clearly if fallback generation is allowed
- preserve source links and status metadata
- record the failure before retrying

## Production Changes

Do not change VPS cron, posting credentials, paid services, or account settings from this repo without a separate explicit deployment task.
