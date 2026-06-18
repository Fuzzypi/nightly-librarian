const assert = require('node:assert/strict');
const test = require('node:test');

const triage = require('../src/triage.js');

test('editorialRules includes Worth attention + Full digest guidance', () => {
  const rules = triage.__test.editorialRules();
  assert.ok(Array.isArray(rules));
  assert.ok(rules.some((rule) => rule.includes('Worth attention')));
  assert.ok(rules.some((rule) => rule.includes('Full digest')));
});

test('completionContract private_memo prompt matches new memo format', () => {
  const contract = triage.completionContract('run-1', [{ id: 'item-1', title: 'T1', url: 'https://example.com' }]);
  assert.equal(contract.run_id, 'run-1');
  assert.ok(contract.private_memo.includes('Worth attention'));
  assert.ok(contract.private_memo.includes('Full digest'));
});

test('buildPrivateMemo includes digest lines when items provided', () => {
  const memo = triage.__test.buildPrivateMemo(
    'run-1',
    2,
    2,
    ['## Worth attention', '- Item A'],
    [{ source_id: 'hn-top', title: 'Hello', url: 'https://example.com', content: '<p>World</p>' }]
  );
  assert.ok(memo.includes('## Worth attention'));
  assert.ok(memo.includes('## Full digest'));
  assert.ok(memo.includes('[hn-top] Hello — https://example.com'));
});

test('textSnippetFromHtml strips tags and truncates', () => {
  const out = triage.__test.textSnippetFromHtml('<p>Hello <b>world</b></p>', 20);
  assert.equal(out, 'Hello world');
});
