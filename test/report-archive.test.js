const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseDailyReportMarkdown,
  parseLegacyReportMarkdown,
} = require("../src/report-archive.js");

test("parseDailyReportMarkdown extracts report sections and summary", () => {
  const markdown = `# Nightly Librarian — Newsletter draft

Run: run-123
Started: 2026-05-24T06:10:00.000Z
Completed: 2026-05-24T06:21:00.000Z

## Worth attention

- **Example story one**
  https://example.com/one
  First important summary.
- **Example story two**
  https://example.com/two
  Second important summary.

## Full digest

- [P] [source-a] Example story one — https://example.com/one — First important summary.
- [R] [source-b] Example story three — https://example.com/three — Rejected summary.
`;

  const report = parseDailyReportMarkdown(markdown, "2026-05-24");

  assert.equal(report.kind, "daily-report");
  assert.equal(report.runId, "run-123");
  assert.equal(report.worthAttention.length, 2);
  assert.equal(report.fullDigest.length, 2);
  assert.equal(report.worthAttention[0].title, "Example story one");
  assert.equal(report.fullDigest[0].tag, "P");
  assert.match(report.summary.text, /stories cleared the bar/);
});

test("parseLegacyReportMarkdown extracts signals and verdict", () => {
  const markdown = `═══════════════════════════════════════════
THE NIGHTLY LIBRARIAN
2026-05-10 — Issue #0
═══════════════════════════════════════════

─── THE 5 SIGNALS ─────────────────────────

1. Tooling headline
   Important context about the tooling headline.

2. Workflow headline
   Important context about the workflow headline.

─── TRY THIS ───────────────────────────────

Ship the new benchmark harness.

─── LIBRARIAN'S VERDICT ────────────────────

Action items today: investigate the workflow change.
`;

  const report = parseLegacyReportMarkdown(markdown, "2026-05-09-233256");

  assert.equal(report.kind, "legacy-report");
  assert.equal(report.date, "2026-05-10");
  assert.equal(report.issue, "Issue #0");
  assert.equal(report.signals.length, 2);
  assert.equal(report.signals[0].title, "Tooling headline");
  assert.match(report.verdict, /workflow change/);
  assert.match(report.summary.text, /tracked 2 signals/);
});
