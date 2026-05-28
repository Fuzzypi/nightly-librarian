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

## Producer Export Command

Phase 3 adds a structured export mode to the existing producer report path:

```bash
mkdir -p artifacts/upstream
npm run triage:export -- --run-id RUN_ID --date YYYY-MM-DD > artifacts/upstream/YYYY-MM-DD.producer.json
```

`triage:export` emits JSON to stdout. It preserves the existing `triage:report` markdown behavior by using a separate command that internally selects `--format structured-json`.

Producer export rules:

- exports completed producer runs only
- rejects failed, partial, running, or unknown run states before import
- preserves source URLs through `url` and `evidence_sources`
- preserves source claims through `raw_claim`
- includes category, verdict, evidence level, uncertainty, scores, and builder/operator relevance fields
- does not post to public channels
- does not create paid-service dependencies
- does not add a new database or credential path

Producer export shape:

```json
{
  "schema": "nightly-librarian.triage-candidate-export/v1",
  "date": "YYYY-MM-DD",
  "status": "reported",
  "run_status": "completed",
  "mode": "primary",
  "title": "Nightly Librarian - YYYY-MM-DD",
  "summary": "Completed Nightly Librarian run with promoted/scored/rejected counts.",
  "completed_at": "2026-05-20T07:00:00.000Z",
  "run_id": "producer-run-id",
  "items": [
    {
      "raw_item_id": "stable-raw-item-id",
      "title": "Story title",
      "url": "https://source.example/item",
      "source_id": "Source Name",
      "published_at": "2026-05-20T00:00:00.000Z",
      "fetched_at": "2026-05-20T00:05:00.000Z",
      "category": "agent_workflow",
      "verdict": "publish_public",
      "raw_claim": "Fact attributed to the source.",
      "summary": "Producer summary.",
      "worth_mentioning_reason": "Why this matters to builders/operators.",
      "evidence_level": "vendor_claim",
      "evidence_sources": ["https://source.example/item"],
      "uncertainty": "",
      "verdict_reason": "Why the producer assigned this verdict.",
      "score_worth_mentioning": 5,
      "score_decision_impact": 5
    }
  ]
}
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

- be a teaser (1–2 posts) summarizing the most important themes
- avoid dumping 40 links into social
- keep each post within platform limits
- avoid unmarked rumors or unsupported benchmark claims
- end with a single link to the public landing page / brief (which contains the full index of researched links)

## LinkedIn Output

The LinkedIn draft should:

- be 1–3 short paragraphs: what's happening + why it matters for builders/operators
- avoid including per-item source links (use the landing-page link instead)
- avoid engagement bait
- avoid pretending CalenCall or Veremun are the topic unless directly relevant
- end with a single link to the public landing page / brief

## Landing Page / Archive Output

The static brief should:

- start with a short daily synthesis (1–2 paragraphs)
- summarize every “worth mentioning” item (publish + monitor) with source facts + takeaway
- include a complete link index of every researched item (including rejects) for transparency
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

Generated output defaults to `approved: false`. Approval is a separate explicit local artifact, not a side effect of generation.

Approval create command:

```bash
npm run approval:create -- \
  --date YYYY-MM-DD \
  --digest artifacts/digests/YYYY-MM-DD.json \
  --approval artifacts/approvals/YYYY-MM-DD.json \
  --approver "Name" \
  --approved-at YYYY-MM-DDTHH:MM:SS.sssZ
```

Approval validation command:

```bash
npm run approval:validate -- \
  --date YYYY-MM-DD \
  --digest artifacts/digests/YYYY-MM-DD.json \
  --approval artifacts/approvals/YYYY-MM-DD.json
```

Approval artifacts live under:

```text
artifacts/approvals/YYYY-MM-DD.json
```

Expected approval shape:

```json
{
  "schema": "nightly-librarian.approval/v1",
  "approval_version": "approval/v1",
  "date": "YYYY-MM-DD",
  "status": "approved",
  "approved": true,
  "approver": "Name",
  "approved_at": "2026-05-20T08:00:00.000Z",
  "channels_approved": ["brief", "x", "linkedin"],
  "digest": {
    "path": "artifacts/digests/YYYY-MM-DD.json",
    "sha256": "hex string",
    "status": "completed",
    "mode": "primary",
    "generated_at": "2026-05-20T07:00:00.000Z"
  },
  "social": {
    "generator_version": "social-generate/v4",
    "manifest": {
      "path": "dist/social/YYYY-MM-DD.json",
      "sha256": "hex string"
    },
    "brief": {
      "path": "dist/briefs/YYYY-MM-DD.md",
      "sha256": "hex string"
    },
    "x": {
      "path": "dist/social/YYYY-MM-DD.x.md",
      "sha256": "hex string",
      "post_count": 0
    },
    "linkedin": {
      "path": "dist/social/YYYY-MM-DD.linkedin.md",
      "sha256": "hex string",
      "character_count": 0
    }
  },
  "policy_checks": {
    "digest_completed": true,
    "source_links_preserved": true,
    "facts_labeled": true,
    "fallback_labeled": true,
    "not_stale": true,
    "draft_not_published": true
  }
}
```

Validation rules:

- approval must exist; absence means not approved
- `date` must match the requested date
- `status` must be `approved` and `approved` must be `true`
- `approved_at` must be at or after the digest `generated_at`
- digest path and SHA-256 must match the requested digest
- generator version and deterministic social draft hashes must match what `social:generate` would produce
- every required policy check must be true
- validation must not write `dist/`, post publicly, call the network, read credentials, connect to databases, or schedule anything

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
