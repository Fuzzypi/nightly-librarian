# Spec: Phase 5 — Cheap-First Distribution (Execution Plan)

**Date:** 2026-06-16
**Status:** planning
**Owner:** Fuzzy

Sequences the three open Phase 5 threads. Phase 5's goal (per ROADMAP): publish a
static archive/landing page, run social drafts manually for 2–4 weeks, and track
engagement + email demand *before* paying for newsletter or scheduling tools.

## Current reality (grounded 2026-06-16)

- **Site:** live at thenightlylibrarian.com, auto-deploys from `main` via Cloudflare
  Pages. SEO/OG/RSS/sitemap/dark-mode all present. 27-day archive back to May 21. ✅
- **Substack:** exists, launched ~2026-05-26, subscribe forms wired correctly. ✅
- **Social drafts:** X + LinkedIn generate every run; `post-social.js` + approval gate
  built (decision #900). All drafts marked "not approved." ⚠️ not being posted.
- **Analytics:** none. No beacon/GA/Plausible anywhere in the site build. ❌
- **Daily publish:** unreliable. Working tree dirty with two competing 2026-06-16
  briefs (live ≠ local). `git diff --check` whitespace failures + unrelated dirty
  state have blocked commit/push on Jun 6, 13, 14 (brain sessions 2464/2578/2604). ❌

## Sequencing logic

Order is driven by dependency, not effort: the brief must land reliably before
measurement matters, and measurement must exist before the social experiment can
produce data worth acting on.

```
Thread 2 (publish reliability)  →  Thread 1 (analytics)  →  Thread 3 (social cadence, 2–4 wks)  →  Phase 6 gate
   foundation                       measurement baseline      demand generation                    decision
```

---

## Thread 2 — Make the daily publish reliable  [do first]

**Why first:** if the brief doesn't land live every day, analytics measures nothing
and social posts point at stale pages. Cheapest fix, unblocks everything.

Scope:
1. Resolve today's competing briefs — decide whether the live (Apple Foundation
   Models…) or local (n8n…) 2026-06-16 brief is canonical, or synthesize them via
   `synthesize:runs`. Get the tree clean.
2. Kill the recurring `git diff --check` failure: normalize trailing whitespace in
   `build-site.js` output so generated HTML never trips the check.
3. Tighten the publish path so only `dist/briefs/YYYY-MM-DD.md` + `reports/YYYY-MM-DD.md`
   are staged (per CODEX-HANDOFF), independent of unrelated dirty state.
4. Verify: `npm run build:site && npm run publish:check`, then confirm live deploy.

Done when: a daily run commits + deploys the brief with no manual git surgery.

## Thread 1 — Stand up the measurement layer  [do second]

**Why second:** keystone of Phase 5. Must be live *before* the social experiment so
there's a clean baseline to attribute against.

Scope:
1. Add **Cloudflare Web Analytics** (free, privacy-first, site already on CF Pages) —
   inject the beacon snippet in `build-site.js` so every page (index, briefs, reports)
   carries it. One-time deploy.
2. Confirm **Google Search Console** is verified for the domain (Ahrefs GSC connector
   is available) so organic queries/impressions are captured.
3. Define the weekly scorecard: unique visitors, top briefs, referrers (esp. social),
   RSS pulls, and Substack subscriber count + growth. Decide where it lives (a
   `reports/engagement-WEEK.md` or a live Cowork artifact).

Done when: visits, referrers, and subscriber growth are all being counted and a weekly
scorecard can be produced from real data.

## Thread 3 — Run the manual social cadence  [do third, 2–4 weeks]

**Why third:** this is the demand-generation engine. Only meaningful once briefs land
reliably (T2) and traffic it drives can be attributed (T1).

Scope:
1. Daily loop: review the generated X + LinkedIn drafts, approve via the existing
   approval gate, post (manually or via `post-social.js`).
2. Tag outbound links with UTM params so Cloudflare/GSC can separate social referrals.
3. Log each day posted; after 2–4 weeks, read the scorecard.

Done when: 2–4 weeks of consistent posting with measured engagement + subscriber data.

## Phase 6 decision gate

After the experiment, use the scorecard to decide — evidence, not assumption:
- Is email demand real enough to justify paid newsletter tooling?
- Which channel (X / LinkedIn / organic / RSS) actually drives subscribers?
- Is scheduling automation (Buffer-class) worth paying for, or is manual fine?

Deferred until this gate clears: paid newsletter tooling, automated posting, Buffer/Beehiiv.
