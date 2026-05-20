# Roadmap

## Phase 0: Baseline Source-of-Truth

Status: current.

- Keep the public GitHub repo clean and Codex-ready.
- Document strategy, architecture, redundancy, operations, content policy, and the social-generation contract.
- Add a local verification command that does not need secrets or network access.
- Keep generated reports, logs, credentials, and machine-local files out of source control.

## Phase 1: Static Archive and Draft Outputs

Status: implemented locally; no posting.

- Defined the completed digest artifact schema used by distribution.
- Generate static markdown briefs from trusted completed digest artifacts.
- Generate X and LinkedIn draft files without posting.
- Keep all generation idempotent by date and source artifact fingerprint.
- Require manual review before any public use.

## Phase 2: Upstream Digest Import

Status: implemented locally; explicit path only.

- Import already-normalized Phase 1 digest artifacts.
- Normalize structured triage candidate exports into `artifacts/digests/YYYY-MM-DD.json`.
- Reject markdown-only, failed, partial, or source-fact-free artifacts.
- Keep import local, deterministic, no-network, no-credentials, and no-database.

## Phase 3: Approval Gates

- Add local policy checks for source citation preservation, factual labeling, fallback labeling, and stale artifact prevention.
- Add an approval manifest for each date.
- Require approved output before public posting is even technically possible.

## Phase 4: Cheap-First Distribution

- Publish a static archive/landing page first.
- Use generated social drafts manually or semi-manually for 2-4 weeks.
- Track engagement and email demand before paying for newsletter or scheduling tools.

## Phase 5: Optional Integrations

- Consider Buffer, Beehiiv, or equivalent tools only after the manual draft workflow proves useful.
- Keep external posting behind dry-run defaults, approval gates, idempotence checks, and explicit credentials.
- Treat paid automation as an optimization, not a baseline requirement.

## Deferred

- Automated public posting
- Paid newsletter tooling
- VPS cron deployment changes
- Rebuilding the upstream librarian
