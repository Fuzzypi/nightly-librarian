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
npm run digest:import -- --date YYYY-MM-DD --source path/to/upstream.json --dry-run
npm run social:generate -- --date YYYY-MM-DD --dry-run
```

`digest:import` reads one explicit local upstream JSON artifact and normalizes it into `artifacts/digests/YYYY-MM-DD.json`. It does not discover production paths, connect to databases, read credentials, or call the network.

`social:generate` reads a completed local digest artifact and writes draft artifacts under `dist/`. It does not post, create paid-service dependencies, read credentials, or call the network.

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

Generated briefs, social drafts, logs, and run completions are output, not source. The default ignored paths include `dist/`, `reports/`, logs, and completion JSON.

Future archive publishing may choose a deliberate tracked/static output path, but that should be a separate decision.

## Incident Handling

If a digest is missing, failed, partial, stale, or untrusted:

- do not publish normal social output
- do not import markdown-only reports as if they contained source facts
- label fallback output clearly if fallback generation is allowed
- preserve source links and status metadata
- record the failure before retrying

## Production Changes

Do not change VPS cron, posting credentials, paid services, or account settings from this repo without a separate explicit deployment task.
