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

## Phase 3: Producer Structured Export

Status: implemented locally; completed runs only.

- Add `npm run triage:export` as a structured JSON export mode for the existing triage report path.
- Preserve default markdown report behavior for `npm run triage:report`.
- Export source URLs, raw source claims, categories, verdicts, evidence levels, scores, and builder/operator relevance fields.
- Reject non-completed producer runs before import.
- Prove the exported JSON round-trips through `digest:import` and `social:generate --dry-run`.

## Phase 4: Approval Gates

Status: implemented locally; no posting.

- Add `approval:create` for explicit local approval artifacts under `artifacts/approvals/YYYY-MM-DD.json`.
- Add `approval:validate` to fail closed unless approval matches the digest hash and deterministic generated social output hashes.
- Reject missing, wrong-date, stale, malformed, digest-mismatched, or social-mismatched approval artifacts.
- Keep approval validation local, deterministic, no-network, no-credentials, no-database, and non-publishing.
- Preserve `digest:import` and `social:generate` behavior.

## Phase 5: Cheap-First Distribution

- Publish a static archive/landing page first.
- Use generated social drafts manually or semi-manually for 2-4 weeks.
- Track engagement and email demand before paying for newsletter or scheduling tools.
- See `specs/phase-5-distribution-plan.md` for the execution order, thread scope, and Phase 6 decision gate.

## Phase 6: Optional Integrations

- Consider Buffer, Beehiiv, or equivalent tools only after the manual draft workflow proves useful.
- Keep external posting behind dry-run defaults, approval gates, idempotence checks, and explicit credentials.
- Treat paid automation as an optimization, not a baseline requirement.

## Deferred

- Automated public posting
- Paid newsletter tooling
- VPS cron deployment changes
- Rebuilding the upstream librarian
