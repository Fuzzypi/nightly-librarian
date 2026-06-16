# Spec: Phase 5 — Cheap-First Distribution (Execution Plan)

Date: 2026-06-16 · Status: in progress · Owner: Fuzzy

Sequences the three open Phase 5 threads. Phase 5's goal (per ROADMAP): publish a
static archive/landing page, run social drafts manually for 2–4 weeks, and track
engagement + email demand before paying for newsletter or scheduling tools.

---

## Implementation status (branch `claude/practical-sagan-wpzhri`)

**Thread 2 — publish reliability — DONE (code).**
- Root cause found: 78 generated `site/*.html` files were committed despite
  `site/` being gitignored, so every `build:site` dirtied the tree and forced
  manual git surgery. Fixed by untracking `site/` (`git rm -r --cached site/`);
  Cloudflare rebuilds it on each deploy.
- `SUBSTACK_SLUG` now defaults to `thenightlylibrarian` (was `YOUR_SLUG`), so a
  rebuild produces correct subscribe forms even without env vars.
- New `npm run publish` (`scripts/publish.js`): builds, runs `publish:check`,
  stages **only** the brief + report markdown (scoped pathspec), runs a staged
  whitespace check, commits, optionally pushes. Robust to unrelated dirty state;
  idempotent on re-runs. Today's competing-brief question is moot — the canonical
  "Apple Foundation Models" 2026-06-16 brief is committed and live.

**Thread 1 — measurement — DONE (code) / pending config.**
- `build-site.js` injects a Cloudflare Web Analytics beacon on every page when
  `CF_WEB_ANALYTICS_TOKEN` is set in the Cloudflare Pages build environment.
  **Action for Fuzzy:** enable Web Analytics in the Cloudflare dashboard and set
  that env var to activate it.
- Weekly scorecard defined: `npm run scorecard` → `reports/engagement-YYYY-Www.md`.
- **Action for Fuzzy:** confirm Google Search Console is verified for the domain.

**Thread 3 — manual social cadence — NOT STARTED (by design).**
- Inherently a 2–4 week manual experiment. UTM tagging on outbound links is the
  one remaining code prerequisite (deferred from this pass).

---

## Sequencing logic

Order is driven by dependency, not effort: the brief must land reliably before
measurement matters, and measurement must exist before the social experiment can
produce data worth acting on.

```
Thread 2 (publish reliability) → Thread 1 (analytics) → Thread 3 (social cadence, 2–4 wks) → Phase 6 gate
   foundation                      measurement baseline    demand generation                  decision
```

## Thread 2 — Make the daily publish reliable [do first]

Why first: if the brief doesn't land live every day, analytics measures nothing
and social posts point at stale pages. Cheapest fix, unblocks everything.

1. Resolve today's competing briefs; get the tree clean.
2. Kill the recurring `git diff --check` failure so generated HTML never trips it.
3. Tighten the publish path so only `dist/briefs/YYYY-MM-DD.md` +
   `reports/YYYY-MM-DD.md` are staged, independent of unrelated dirty state.
4. Verify: `npm run build:site && npm run publish:check`, then confirm live deploy.

Done when: a daily run commits + deploys the brief with no manual git surgery.

## Thread 1 — Stand up the measurement layer [do second]

Why second: keystone of Phase 5. Must be live before the social experiment so
there's a clean baseline to attribute against.

1. Add Cloudflare Web Analytics (free, privacy-first) — inject the beacon in
   `build-site.js` so every page carries it.
2. Confirm Google Search Console is verified for the domain.
3. Define the weekly scorecard: unique visitors, top briefs, referrers (esp.
   social), RSS pulls, Substack subscriber count + growth.

Done when: visits, referrers, and subscriber growth are counted and a weekly
scorecard can be produced from real data.

## Thread 3 — Run the manual social cadence [do third, 2–4 weeks]

1. Daily loop: review the generated X + LinkedIn drafts, approve via the existing
   approval gate, post.
2. Tag outbound links with UTM params so Cloudflare/GSC can separate social
   referrals.
3. Log each day posted; after 2–4 weeks, read the scorecard.

Done when: 2–4 weeks of consistent posting with measured engagement + subscriber
data.

## Phase 6 decision gate

After the experiment, use the scorecard to decide — evidence, not assumption:

- Is email demand real enough to justify paid newsletter tooling?
- Which channel (X / LinkedIn / organic / RSS) actually drives subscribers?
- Is scheduling automation (Buffer-class) worth paying for, or is manual fine?

Deferred until this gate clears: paid newsletter tooling, automated posting,
Buffer/Beehiiv.
