# Nightly Librarian

Source-of-truth repository for the Nightly Librarian Audience Engine.

This repo is the coordination point for distribution, publishing, social draft generation, archive output, and operating policy around the existing Nightly Librarian digest. It does not rebuild the upstream librarian, fetch pipeline, Second Brain memory, or AI-assisted triage loop.

The core product is not a generic newsletter business. It is an AI/dev intelligence and audience engine for builders, operators, and small-business automation people who need to know what changed, why it matters, and what to do about it.

## Current Scope

This repo owns:

- distribution-layer documentation and operating policy
- static archive and landing-page direction
- generated social drafts for X and LinkedIn
- approval gates before anything public is posted
- redundancy and watchdog expectations around digest artifacts
- local verification checks that do not require credentials or network access

This repo does not currently own:

- public posting to X, LinkedIn, Beehiiv, Buffer, or any other channel
- paid-service setup
- production VPS cron changes
- real API keys, tokens, or credentials
- the existing Nightly Librarian content engine

## Strategy

The existing Nightly Librarian produces the curated AI/dev digest. This repository turns trusted digest artifacts into distribution-ready outputs.

The audience is builders, operators, technical founders, and small-business automation people. The editorial thesis is:

> what changed, why it matters, what builders/operators should do about it

Content is organized as:

1. lead story
2. supporting stories
3. archive-only items

Product-aware categories:

- Voice AI / Realtime Agents
- AI Operations / Agent Control
- Data Infrastructure / Verification / Scraping
- Small Business Automation
- Model + API Changes
- Tools Worth Testing

CalenCall and Veremun are downstream product funnels. They may inform examples and calls to action, but they are not the subject of every post.

## Repository Map

- `docs/strategy.md` - official positioning, audience, content hierarchy, and categories
- `docs/architecture.md` - system boundaries and distribution-layer components
- `docs/redundancy.md` - primary AI-assisted path and VPS watchdog fallback rules
- `docs/operations.md` - safe operating procedures
- `docs/content-policy.md` - trust, sourcing, labeling, and factual-claim policy
- `docs/social-generation-contract.md` - `social:generate` artifact contract
- `docs/decisions/0001-cheap-first-distribution.md` - cheap/free-first distribution decision record
- `ROADMAP.md` - staged implementation path
- `VERIFY.md` - local verification gates
- `scripts/verify.sh` - safe local verification command
- `scripts/social-generate.js` - deterministic non-posting artifact generator

## Local Verification

Run:

```bash
npm run verify
```

The verification command is safe to run repeatedly. It does not require secrets or network access.

## Posting Policy

No public posting is implemented in this baseline. Posting must wait until tone, trust policy, source preservation, approval gates, and idempotence rules are proven locally with generated drafts.
