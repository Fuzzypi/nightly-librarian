const assert = require('node:assert/strict');
const test = require('node:test');

const site = require('../scripts/build-site.js');

test('brief pages render the full daily summary lead-in before item lists', () => {
  const markdown = `# Nightly Librarian - 2026-05-20

Date: 2026-05-20
Status: completed
Mode: primary

## Daily summary

Themes: AI Operations / Agent Control • Tools Worth Testing.

Lead signal changes the nightly decision.

Second signal: This is the operational context that explains why the night mattered.

Third signal: This is the tooling context that should be visible before the item list.

## Worth mentioning

### 1. Lead signal

- Source: [example.com](https://example.com/lead)
- Category: AI Operations / Agent Control
- Published: 2026-05-20T00:00:00.000Z

Source facts:
- Lead source fact.

Builder/operator takeaway: Lead signal changes the nightly decision.

Uncertainty: Needs follow-up.
`;

  const brief = site.parseBriefMd(markdown, '2026-05-20');

  assert.equal(brief.leadTakeaway, 'Lead signal changes the nightly decision.');
  assert.equal(
    brief.summaryText,
    'Lead signal changes the nightly decision. Second signal: This is the operational context that explains why the night mattered. Third signal: This is the tooling context that should be visible before the item list.'
  );

  const html = site.renderBriefPage(brief);
  assert.match(html, /Second signal: This is the operational context/);
  assert.match(html, /Third signal: This is the tooling context/);
  assert.ok(
    html.indexOf('Second signal: This is the operational context') < html.indexOf('Worth mentioning'),
    'daily summary lead-in should render before the item list'
  );
});
