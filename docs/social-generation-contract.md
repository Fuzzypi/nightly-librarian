# Social Generation Contract

This document defines the implemented local `social:generate` contract. It is not an external posting implementation.

Dry-run command:

```bash
npm run social:generate -- --date YYYY-MM-DD --dry-run
```

Generation command:

```bash
npm run social:generate -- --date YYYY-MM-DD
```

## Import Command

Phase 2 adds a local importer that converts explicit upstream JSON artifacts into the `social:generate` input contract:

```bash
npm run digest:import -- --date YYYY-MM-DD --source path/to/upstream.json --out artifacts/digests/YYYY-MM-DD.json --dry-run
npm run digest:import -- --date YYYY-MM-DD --source path/to/upstream.json --out artifacts/digests/YYYY-MM-DD.json
```

If `--out` is omitted, the default output is:

```text
artifacts/digests/YYYY-MM-DD.json
```

Importer rules:

- reads only the explicit local `--source` path
- does not discover production paths
- does not call the network
- does not read credentials or environment secrets
- does not require a database connection
- does not modify the upstream source artifact
- refuses to overwrite differing output unless `--force` is passed
- rejects failed, partial, markdown-only, or source-fact-free artifacts

Supported source shapes:

- `phase1-digest`: an already-normalized artifact matching the input shape below.
- `triage-candidate-export`: a structured candidate export with `items`, `candidates`, or `results` entries containing source URLs, source facts or `raw_claim`, builder/operator interpretation, category, status, and mode. If the wrapper status is `reported`, it must also include `run_status: "completed"`.

Markdown-only reports are intentionally not importable. They are useful for humans, but they do not preserve enough structure to distinguish source facts from interpretation safely.

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
  "mode": "primary",
  "title": "Nightly Librarian - YYYY-MM-DD",
  "summary": "Short digest summary",
  "run_id": "string",
  "generated_at": "ISO-8601 timestamp",
  "items": [
    {
      "id": "stable-item-id",
      "title": "Story title",
      "url": "https://source.example/item",
      "source": "Source Name",
      "published_at": "2026-05-20T00:00:00Z",
      "category": "Voice AI / Realtime Agents",
      "importance": "lead",
      "source_facts": ["Fact attributed to source."],
      "builder_takeaway": "Why this matters to builders/operators.",
      "product_relevance": ["CalenCall"],
      "labels": ["launch", "api-change"]
    }
  ]
}
```

Required top-level fields:

- `date`
- `status`
- `mode`
- `title`
- `summary`
- `items`

Required item fields:

- `id`
- `title`
- `url`
- `source`
- `published_at`
- `category`
- `importance`
- `source_facts`
- `builder_takeaway`

Supported status and mode values:

- `status`: only `completed` is accepted for generation.
- `mode`: `primary` or `fallback`.

Generation rejects `failed`, `partial`, missing, date-mismatched, or malformed artifacts. Fallback mode is allowed only when the artifact is still `completed`; generated brief and manifest output label it as fallback.

The importer may add an `imported_from` metadata object containing importer version and source artifact hash. `social:generate` ignores this metadata for rendering, but the raw artifact hash still changes when the import provenance changes.

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
  "mode": "primary",
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
      "source": "string",
      "url": "https://example.com/source",
      "claim_type": "source_fact | benchmark | rumor | launch | opinion"
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
- not write files
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
