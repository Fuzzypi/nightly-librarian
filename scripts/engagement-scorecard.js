#!/usr/bin/env node
"use strict";

/**
 * engagement-scorecard.js — scaffold the Phase 5 weekly engagement scorecard.
 *
 * Phase 5 tracks whether the cheap-first distribution is working before paying
 * for newsletter / scheduling tools. This script stamps a dated weekly file at
 * reports/engagement-YYYY-Www.md with the agreed metric layout and the source
 * for each number, so producing a week's scorecard is one command.
 *
 * The file name is intentionally NOT YYYY-MM-DD.md, so build-site.js and
 * publish-check.js (which match /^\d{4}-\d{2}-\d{2}\.md$/) ignore it — it lives
 * alongside the daily report logs without being rendered as one.
 *
 * Usage:
 *   node scripts/engagement-scorecard.js [--week YYYY-Www] [--date YYYY-MM-DD]
 *                                        [--out PATH] [--force]
 *   npm run scorecard
 *
 * Defaults: the ISO week containing today; refuses to overwrite without --force.
 */

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function utcDate(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// ISO-8601 week number for a date.
function isoWeek(date) {
  const d = utcDate(date.getFullYear(), date.getMonth(), date.getDate());
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = utcDate(d.getUTCFullYear(), 0, 4);
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((d - firstThursday) / (7 * 24 * 3600 * 1000));
  return { year: d.getUTCFullYear(), week };
}

// Monday..Sunday date range (UTC) for an ISO year+week.
function weekRange(year, week) {
  const jan4 = utcDate(year, 0, 4);
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { monday, sunday };
}

function parseArgs(argv) {
  const opts = { date: new Date(), week: null, out: null, force: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--date") {
      opts.dateStr = argv[i + 1] || "";
      i += 1;
    } else if (arg.startsWith("--date=")) {
      opts.dateStr = arg.slice("--date=".length);
    } else if (arg === "--week") {
      opts.week = argv[i + 1] || "";
      i += 1;
    } else if (arg.startsWith("--week=")) {
      opts.week = arg.slice("--week=".length);
    } else if (arg === "--out") {
      opts.out = argv[i + 1] || "";
      i += 1;
    } else if (arg.startsWith("--out=")) {
      opts.out = arg.slice("--out=".length);
    } else if (arg === "--force") {
      opts.force = true;
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (opts.dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.dateStr)) {
      throw new Error(`Invalid --date "${opts.dateStr}" (expected YYYY-MM-DD)`);
    }
    opts.date = new Date(`${opts.dateStr}T12:00:00Z`);
  }

  return opts;
}

function usage() {
  return `Usage: node scripts/engagement-scorecard.js [options]

Scaffolds reports/engagement-YYYY-Www.md for the Phase 5 weekly scorecard.

Options:
  --week YYYY-Www   Target ISO week (e.g. 2026-W25)
  --date YYYY-MM-DD Any date in the target week (default: today)
  --out PATH        Output path (default: reports/engagement-YYYY-Www.md)
  --force           Overwrite an existing file
  --help, -h        Show this help
`;
}

function resolveWeek(opts) {
  if (opts.week) {
    const m = opts.week.match(/^(\d{4})-W(\d{1,2})$/i);
    if (!m) throw new Error(`Invalid --week "${opts.week}" (expected YYYY-Www, e.g. 2026-W25)`);
    return { year: Number(m[1]), week: Number(m[2]) };
  }
  return isoWeek(opts.date);
}

function template({ label, monday, sunday }) {
  return `# Engagement scorecard — ${label}

Week: ${isoDate(monday)} → ${isoDate(sunday)} (Mon–Sun)
Phase: 5 — Cheap-First Distribution
Status: draft

> Fill the blanks from the sources noted in each row. Numbers feed the Phase 6
> decision gate: is email demand real, which channel drives subscribers, and is
> paid automation worth it. Source: Cloudflare Web Analytics + GSC + Substack.

## Audience — Cloudflare Web Analytics

_Source: dash.cloudflare.com → Web Analytics → thenightlylibrarian.com (or the
Ahrefs \`web-analytics-*\` tools once the site is connected)._

| Metric | This week | Prev week | Δ |
|---|---|---|---|
| Unique visitors | — | — | — |
| Page views | — | — | — |
| Median page load (ms) | — | — | — |

Top brief / report pages (by visits):

1. —
2. —
3. —

Referrers (top sources):

| Referrer | Visits | Notes |
|---|---|---|
| — | — | social? organic? direct? |

Social referrals (broken out via UTM \`utm_source\`):

| utm_source | utm_medium | Visits |
|---|---|---|
| x | social | — |
| linkedin | social | — |

## Search — Google Search Console

_Source: Search Console, or the Ahrefs \`gsc-*\` tools. Confirm the domain is
verified (Thread 1.2)._

| Metric | This week | Prev week |
|---|---|---|
| Impressions | — | — |
| Clicks | — | — |
| Avg. position | — | — |

Top queries:

1. —
2. —
3. —

## Syndication — RSS

_Source: Cloudflare Web Analytics top pages filtered to \`/feed.xml\`._

| Metric | This week | Prev week |
|---|---|---|
| /feed.xml pulls | — | — |

## Email — Substack

_Source: Substack dashboard → Subscribers._

| Metric | This week | Prev week |
|---|---|---|
| Total subscribers | — | — |
| Net new this week | — | — |
| Growth % | — | — |

## Social — posting log

_Source: the daily posting log (which drafts were approved + posted)._

| Channel | Posts shipped | Notable engagement |
|---|---|---|
| X | — | — |
| LinkedIn | — | — |

## Read

- What the numbers say: —
- What's working / not: —
- Phase 6 signal (email demand? which channel? automation worth paying for?): —
`;
}

function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return 2;
  }

  if (opts.help) {
    console.log(usage());
    return 0;
  }

  let resolved;
  try {
    resolved = resolveWeek(opts);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  const label = `${resolved.year}-W${String(resolved.week).padStart(2, "0")}`;
  const { monday, sunday } = weekRange(resolved.year, resolved.week);
  const outPath = opts.out
    ? path.resolve(opts.out)
    : path.join(REPO_ROOT, "reports", `engagement-${label}.md`);

  if (fs.existsSync(outPath) && !opts.force) {
    console.error(`refusing to overwrite ${path.relative(REPO_ROOT, outPath)} (pass --force)`);
    return 1;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, template({ label, monday, sunday }), "utf8");
  console.log(`wrote ${path.relative(REPO_ROOT, outPath)}`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { main, isoWeek, weekRange, resolveWeek };
