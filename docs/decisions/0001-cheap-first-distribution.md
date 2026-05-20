# ADR-0001: Cheap-First Distribution

## Status

Accepted

## Date

2026-05-20

## Context

Nightly Librarian already produces a curated AI/dev digest. The next step is distribution and audience development, not rebuilding the content engine.

Cost discipline matters. Beehiiv, Buffer, and similar tools can be useful later, but paying for distribution before proving tone, demand, and approval gates creates avoidable cost and operational pressure.

## Decision

Start with a static site/archive plus generated social drafts.

Do not pay for Beehiiv, Buffer, or similar tools until engagement or email demand justifies it.

Manual or semi-manual approval is acceptable for the first 2-4 weeks.

Fully automated public posting comes only after tone, trust policy, source preservation, idempotence, and approval gates are proven locally.

## Alternatives Considered

### Pay for newsletter and scheduling tools immediately

Pros:

- faster path to automated distribution
- less manual copy/paste

Cons:

- recurring cost before demand is proven
- pressure to post before trust gates are mature
- more credentials and integration surface

Rejected for now.

### Build full public-posting automation first

Pros:

- technically complete pipeline
- less manual work later

Cons:

- higher blast radius
- premature account mutation
- harder to debug tone and trust issues

Rejected for baseline.

## Consequences

- The first distribution loop is slower but safer.
- Draft quality and audience response can be observed before paying for tooling.
- Public posting remains blocked until approval gates exist.
- Static/archive output becomes the durable foundation.
