# Agent Instructions

This repository is the official GitHub source-of-truth for the Nightly Librarian Audience Engine distribution layer.

## Lane

Authorized work in this repo:

- docs for strategy, architecture, redundancy, operations, and content policy
- safe local verification
- social draft generation contracts and non-posting stubs
- static archive and landing-page preparation
- approval-gate design

Do not rebuild the existing Nightly Librarian content engine. Treat the upstream digest pipeline as an external producer.

## Hard Stops

Stop before:

- public posting to X, LinkedIn, Beehiiv, Buffer, or any other channel
- paid account setup or paid-service dependency changes
- entering or committing credentials
- changing VPS cron or production deployment settings
- moving unrelated files from other repositories
- publishing stale, failed, partial, or untrusted digest output as normal content

## Workflow

Use this order for non-trivial changes:

1. inspect repo state
2. plan the exact scope
3. edit only the files in scope
4. run `npm run verify`
5. run `git diff --check`
6. inspect staged changes before commit
7. commit and push only when verification passes

## Content Rules

Source links must be preserved. Factual claims must distinguish source fact from interpretation. Rumors, benchmarks, launches, and opinions must be labeled clearly.

CalenCall and Veremun are downstream product funnels, not the default subject of posts.

## Secret Handling

Never commit real tokens, API keys, `.env` files, local logs, virtualenvs, `node_modules`, build output, or generated run artifacts. Use `.env.template` only for placeholders.
