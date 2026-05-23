# Codex Handoff — Nightly Librarian Synthesis Workflow

**As of: 2026-05-23 | HEAD: `944deb8`**

This document is for the Codex cron agent. Read it before your next triage run.

---

## What Changed

A synthesis workflow was added so that Cowork and Codex triage runs both contribute to the site brief instead of one silently overwriting the other.

The live site is at **https://thenightlylibrarian.com** — auto-deployed from `main` via Cloudflare Pages on every push. Every `dist/briefs/YYYY-MM-DD.md` you commit becomes a live page within ~30 seconds of push.

---

## Your Role in the Pipeline

You are one of two scoring agents. Cowork is the other. Both of you:

1. Call `triage:claim` → get a batch of raw items + a `run_id`
2. Score each item and produce a `completion-{run_id}.json`
3. Call `triage:complete` to write verdicts to the DB

After **both** completions exist, one agent (see "Who Runs Synthesis" below) runs:

```
synthesize:runs → digest:import → social:generate → build:site → git push
```

---

## Completion JSON Format

Your output from triage must be a file named `completion-{run_id}.json` with this shape:

```json
{
  "run_id": "your-uuid-from-triage-claim",
  "private_memo": "# Morning memo — YYYY-MM-DD\n\n...",
  "results": [
    {
      "raw_item_id": "uuid",
      "title": "...",
      "summary": "one-line summary",
      "raw_claim": "factual claim from source",
      "category": "agent_workflow|model_change|open_source|...",
      "evidence_level": "vendor_claim|early_signal|builder_reported|reproducible|production_proven",
      "evidence_sources": ["https://..."],
      "uncertainty": "",
      "worth_mentioning_reason": "why this matters to a solo builder (leave empty for rejects)",
      "score_worth_mentioning": 0-10,
      "score_solo_dev_relevance": 0-10,
      "score_owner_work_relevance": 0-10,
      "score_future_work_relevance": 0-10,
      "score_decision_impact": 0-10,
      "score_evidence_strength": 0-10,
      "score_cost_time_leverage": 0-10,
      "score_risk_reduction": 0-10,
      "score_business_opportunity": 0-10,
      "score_hype_risk": 0-10,
      "score_novelty_penalty": 0-10,
      "verdict": "publish_public|publish_private|monitor|reject",
      "verdict_reason": "one line explaining the verdict"
    }
  ]
}
```

The `triage:claim` response gives you the full contract. Follow it exactly.

---

## The Synthesis Step

### Script: `scripts/synthesize-runs.js`

```bash
npm run synthesize:runs -- \
  --primary  completion-AAAA.json \
  --secondary completion-BBBB.json \
  --date YYYY-MM-DD \
  [--out artifacts/synthesized/YYYY-MM-DD.json]
```

**Merge rules:**
- Items are deduplicated by `raw_item_id`
- For the same item in both runs: **higher verdict wins** (`publish_public` > `publish_private` > `monitor` > `reject`), then higher `score_worth_mentioning` breaks ties
- `private_memo` sections are merged (concatenated if different)
- `--secondary` is optional — omit it on single-run days

Output goes to `artifacts/synthesized/YYYY-MM-DD.json` (gitignored — do not commit it).

### Full publish pipeline after synthesis:

```bash
npm run digest:import -- \
  --date YYYY-MM-DD \
  --source artifacts/synthesized/YYYY-MM-DD.json \
  --out artifacts/digests/YYYY-MM-DD.json

npm run social:generate -- --date YYYY-MM-DD

npm run build:site

git add dist/briefs/YYYY-MM-DD.md
git commit -m "brief: YYYY-MM-DD"
git push
```

Only `dist/briefs/YYYY-MM-DD.md` gets committed. Everything in `artifacts/` and `dist/social/` stays local.

---

## Who Runs Synthesis

**Recommended split:** Codex runs synthesis and pushes. Cowork produces its completion JSON and makes it available (e.g., in a shared path or via the repo's `upstream/` dir), then Codex picks it up.

**Simplest arrangement for now:**

1. Cowork finishes triage → saves `completion-{cowork-run-id}.json` to `upstream/cowork-YYYY-MM-DD.json` (not committed, just local/shared)
2. Codex finishes triage → saves its own `completion-{codex-run-id}.json`
3. Codex checks for the Cowork file and runs synthesis:

```bash
COWORK_FILE="upstream/cowork-$(date +%Y-%m-%d).json"
CODEX_FILE="completion-${CODEX_RUN_ID}.json"
DATE=$(date +%Y-%m-%d)

if [ -f "$COWORK_FILE" ]; then
  npm run synthesize:runs -- \
    --primary "$CODEX_FILE" \
    --secondary "$COWORK_FILE" \
    --date "$DATE"
else
  # Cowork didn't run — proceed with Codex-only
  npm run synthesize:runs -- \
    --primary "$CODEX_FILE" \
    --date "$DATE"
fi

npm run digest:import -- --date "$DATE" \
  --source "artifacts/synthesized/${DATE}.json" \
  --out "artifacts/digests/${DATE}.json"

npm run social:generate -- --date "$DATE"
npm run build:site

git add "dist/briefs/${DATE}.md"
git commit -m "brief: ${DATE}"
git push
```

---

## .gitignore — What Gets Committed vs. Not

| Path | Committed? |
|------|-----------|
| `dist/briefs/YYYY-MM-DD.md` | ✅ Yes — required for Cloudflare build |
| `dist/social/` | ❌ No |
| `artifacts/synthesized/` | ❌ No |
| `artifacts/digests/` | ❌ No |
| `completion-*.json` | ❌ No |
| `scripts/synthesize-runs.js` | ✅ Already committed |

Only the brief markdown goes to the repo. Everything else is ephemeral.

---

## Cloudflare Pages Build

- **Repo:** `Fuzzypi/nightly-librarian` (GitHub)
- **Build command:** `npm run build:site`
- **Output dir:** `site/`
- **Triggers:** every push to `main`
- **Live domain:** `thenightlylibrarian.com`

The build reads `dist/briefs/*.md` from the repo. That's why the brief markdown must be committed. Nothing else needs to be in the repo for the site to build.

---

## Verification Before Push

```bash
npm run verify          # runs scripts/verify.sh
git diff --check        # no trailing whitespace
head -5 dist/briefs/YYYY-MM-DD.md  # sanity check the brief
```

If `build:site` fails with `dist/briefs/ not found`, the brief wasn't committed. Check `git status`.

---

## Key Files

| File | Purpose |
|------|---------|
| `scripts/synthesize-runs.js` | Merge Cowork + Codex completions |
| `scripts/digest-import.js` | Normalize to digest contract |
| `scripts/social-generate.js` | Generate brief + social drafts |
| `scripts/build-site.js` | Build static HTML site |
| `src/triage.js` | claim / complete / export DB logic |
| `src/index.js` | CLI entry point |
| `AGENTS.md` | Hard stops and lane rules — read this |
