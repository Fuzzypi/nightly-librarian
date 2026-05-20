# Social Generation Contract

This document defines the future `social:generate` contract. It is not an external posting implementation.

Current safe stub:

```bash
npm run social:generate -- --date YYYY-MM-DD --dry-run
```

Future generation command:

```bash
npm run social:generate -- --date YYYY-MM-DD
```

## Input Artifact

Expected source path:

```text
artifacts/digests/YYYY-MM-DD.json
```

Expected input shape:

```json
{
  "date": "YYYY-MM-DD",
  "status": "completed",
  "trust": "trusted",
  "run_id": "string",
  "generated_at": "ISO-8601 timestamp",
  "source_artifact_sha256": "hex string",
  "fallback": false,
  "lead_story": {
    "title": "string",
    "category": "Model + API Changes",
    "source_url": "https://example.com/source",
    "source_facts": ["string"],
    "interpretation": "string",
    "builder_action": "string",
    "uncertainty": "string or null"
  },
  "supporting_stories": [],
  "archive_only": []
}
```

Required story fields:

- `title`
- `category`
- `source_url`
- `source_facts`
- `interpretation`
- `builder_action`
- `uncertainty`

Allowed status values:

- `completed`
- `fallback`
- `failed`
- `partial`

Generation must reject `failed`, `partial`, missing, stale, or untrusted artifacts unless explicitly run under a fallback policy.

## Output Artifacts

Suggested output paths:

```text
dist/briefs/YYYY-MM-DD.md
dist/social/YYYY-MM-DD.json
dist/social/YYYY-MM-DD.x.md
dist/social/YYYY-MM-DD.linkedin.md
```

`dist/social/YYYY-MM-DD.json` should include:

```json
{
  "date": "YYYY-MM-DD",
  "status": "draft",
  "input_artifact": "artifacts/digests/YYYY-MM-DD.json",
  "input_sha256": "hex string",
  "generated_at": "ISO-8601 timestamp",
  "generator_version": "string",
  "approved": false,
  "fallback": false,
  "channels": {
    "x": {
      "path": "dist/social/YYYY-MM-DD.x.md",
      "post_count": 0,
      "character_counts": []
    },
    "linkedin": {
      "path": "dist/social/YYYY-MM-DD.linkedin.md",
      "character_count": 0
    },
    "brief": {
      "path": "dist/briefs/YYYY-MM-DD.md"
    }
  },
  "sources": [
    {
      "title": "string",
      "url": "https://example.com/source",
      "claim_type": "source_fact | interpretation | benchmark | rumor | launch | opinion"
    }
  ]
}
```

## X Thread Output

The X thread draft should:

- start with the lead story
- preserve source links
- label facts, interpretation, and actions
- keep each post within platform limits
- avoid unmarked rumors or unsupported benchmark claims
- end with a link to the static brief/archive when available

## LinkedIn Output

The LinkedIn draft should:

- use one concise opening claim
- explain practical builder/operator impact
- include source links
- avoid engagement bait
- avoid pretending CalenCall or Veremun are the topic unless directly relevant

## Landing Page / Archive Output

The static brief should:

- preserve lead/supporting/archive hierarchy
- include source links for each promoted item
- label fallback status if applicable
- distinguish source facts from Nightly Librarian interpretation

## Dry-Run Behavior

Dry run must:

- avoid network access
- avoid credentials
- avoid public posting
- print planned input and output paths
- report gating status
- not mutate approval state

## Approval Gate

Generated output defaults to `approved: false`.

Future posting commands may only consume approved artifacts. Approval must record:

- approver
- timestamp
- input artifact hash
- generator version
- channels approved

## Failure Behavior

On failure:

- exit nonzero
- leave existing approved outputs untouched
- write no partial public-channel artifacts unless clearly marked temporary
- explain whether the failure is input, policy, validation, or filesystem related

## Idempotence

For the same date, input hash, and generator version, output must be deterministic.

If output already exists:

- identical output is a no-op
- changed output requires a new input hash, generator version, or explicit `--force`
- approved output must not be overwritten without explicit approval invalidation
