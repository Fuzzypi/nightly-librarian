# Architecture

## Boundary

Nightly Librarian already exists as a digest-producing system. This repository does not replace that system.

This repo owns the distribution layer around completed digest artifacts:

- artifact contract
- completed-run structured export for the existing triage/report producer path
- upstream artifact import and normalization
- social draft generation
- static archive and landing-page outputs
- local approval artifact creation and validation
- operations documentation
- redundancy policy

## Upstream Producer

The upstream librarian is responsible for:

- fetching sources
- extracting raw items
- AI-assisted triage
- scoring and categorization
- private memo generation
- completed digest artifacts

The distribution layer consumes only completed, trusted artifacts or explicitly labeled fallback artifacts.

## Distribution Layer

Planned components:

- `triage:export` command: emits structured JSON from an existing completed producer run
- `digest:import` contract: turns one explicit local upstream JSON artifact into the completed digest artifact shape
- `social:generate` contract: turns one trusted digest artifact into markdown and JSON draft outputs
- static archive generator: produces `dist/briefs/YYYY-MM-DD.md`
- social draft writer: produces X and LinkedIn drafts under `dist/social/`
- approval artifact: records explicit approval for a date, digest hash, generator version, and social output hashes
- policy verifier: blocks stale, failed, partial, or untrusted output from being treated as normal content

## Data Flow

```text
Upstream fetch/triage/editor
  -> completed producer run
  -> triage:export structured JSON
  -> explicit local upstream JSON artifact
  -> digest:import
  -> completed digest artifact
  -> distribution policy checks
  -> static brief draft
  -> X and LinkedIn draft files
  -> human or policy approval
  -> approval:validate
  -> future public posting or manual copy/paste
```

Fallback artifacts may enter the same flow only when their fallback status is explicit and the content policy allows them.

## Non-Goals

- No public posting in the baseline.
- No paid distribution service dependency.
- No real credentials in source control.
- No production cron mutation from this repo without a separate deployment task.
