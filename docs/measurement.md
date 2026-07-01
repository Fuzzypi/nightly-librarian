# Measurement

## Goal

Track whether the static archive/landing page is getting real attention before the project pays for newsletter or scheduling tooling.

This repo already injects the Cloudflare Web Analytics beacon when `CF_WEB_ANALYTICS_TOKEN` is set. The remaining work is operational: confirm the domain property in Google Search Console, then review the weekly numbers in a consistent scorecard.

## Setup

1. Set `CF_WEB_ANALYTICS_TOKEN` in the runtime environment or `.env`.
2. Deploy the site so every generated page includes the Cloudflare beacon.
3. Verify `thenightlylibrarian.com` in Google Search Console.
4. Keep outbound social links tagged with UTMs so Cloudflare and Search Console can separate social referrals from organic traffic.

## Weekly Scorecard Location

Use a tracked markdown report under `reports/engagement-YYYY-WW.md` for the weekly scorecard. Keep it local and deterministic; do not turn it into a posting or automation dependency.

## Weekly Scorecard Template

```md
# Weekly Engagement Scorecard — YYYY-WW

Week ending: YYYY-MM-DD

## Site

- Unique visitors:
- Returning visitors:
- Top briefs:
- Top referrers:
- Social referrers:
- RSS pulls:

## Search Console

- Total clicks:
- Total impressions:
- Top queries:
- Top pages:

## Substack

- Subscribers:
- Net new subscribers:
- Notes:

## Observations

- What changed:
- What seems to be working:
- What is still unclear:

## Next Actions

- 
```

## Reading the Scorecard

- Unique visitors and referrers show whether the landing page is getting reach.
- Top briefs show which topics earn attention.
- Search Console shows whether organic discovery is improving.
- Substack subscriber growth is the demand signal for newsletter value.
- The scorecard is only useful if the same fields are tracked every week.
