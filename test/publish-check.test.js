const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const publishCheck = require('../scripts/publish-check.js');

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-check-'));

  write(root, 'dist/briefs/2026-05-20.md', '# Brief\n\n## Daily summary\n\nUseful summary.\n');
  write(root, 'reports/2026-05-20.md', '# Report\n');
  write(root, 'site/index.html', '<html>index</html>');
  write(root, 'site/feed.xml', '<rss></rss>');
  write(root, 'site/sitemap.xml', '<urlset></urlset>');
  write(
    root,
    'site/briefs/2026-05-20/index.html',
    `<html><body><p class="lead-summary">This is a meaningful lead summary with enough detail to help a publisher understand the main operational signal before publishing the generated site.</p></body></html>`
  );
  write(root, 'site/reports/2026-05-20/index.html', '<html>report</html>');

  return root;
}

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

test('passes when latest generated brief and report have matching site pages', () => {
  const root = makeFixture();

  const result = publishCheck.checkPublishReadiness({ root });

  assert.equal(result.ok, true);
  assert.equal(result.latestBriefDate, '2026-05-20');
  assert.equal(result.latestReportDate, '2026-05-20');
  assert.ok(result.results.some((entry) => entry.message === 'Latest brief page has a meaningful lead summary'));
});

test('fails when the latest generated brief page is missing', () => {
  const root = makeFixture();
  fs.rmSync(path.join(root, 'site/briefs/2026-05-20/index.html'));

  const result = publishCheck.checkPublishReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.fatal.some((entry) => entry.message === 'Latest brief page is missing'));
});

test('fails when the latest generated report page is missing', () => {
  const root = makeFixture();
  fs.rmSync(path.join(root, 'site/reports/2026-05-20/index.html'));

  const result = publishCheck.checkPublishReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.fatal.some((entry) => entry.message === 'Latest report page is missing'));
});

test('fails when the latest brief lead summary is too thin', () => {
  const root = makeFixture();
  write(root, 'site/briefs/2026-05-20/index.html', '<html><body><p class="lead-summary">TBD</p></body></html>');

  const result = publishCheck.checkPublishReadiness({ root });

  assert.equal(result.ok, false);
  assert.ok(result.fatal.some((entry) => entry.message === 'Latest brief page is missing a meaningful lead summary'));
});

test('selects the newest dated generated files', () => {
  const root = makeFixture();
  write(root, 'dist/briefs/2026-05-21.md', '# Newer brief\n');
  write(root, 'reports/2026-05-21.md', '# Newer report\n');

  const result = publishCheck.checkPublishReadiness({ root });

  assert.equal(result.ok, false);
  assert.equal(result.latestBriefDate, '2026-05-21');
  assert.equal(result.latestReportDate, '2026-05-21');
  assert.ok(result.fatal.some((entry) => entry.detail === 'Expected site/briefs/2026-05-21/index.html'));
  assert.ok(result.fatal.some((entry) => entry.detail === 'Expected site/reports/2026-05-21/index.html'));
});

test('extracts lead summary from meta description when the class is absent', () => {
  const text = 'This meta description is long enough to count as a meaningful lead summary for local preflight checks before static publishing proceeds.';

  const extracted = publishCheck.extractLeadSummary(`<html><head><meta name="description" content="${text}"></head></html>`);

  assert.equal(extracted, text);
  assert.equal(publishCheck.isMeaningfulLead(extracted), true);
});
