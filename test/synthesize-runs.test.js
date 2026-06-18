const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const digestImport = require('../scripts/digest-import.js');
const synthesizeRuns = require('../scripts/synthesize-runs.js');
const triage = require('../src/triage.js');

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-synthesize-runs-'));
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  return root;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('synthesize produces an importable artifact when the completion contract includes raw claims', () => {
  const root = makeTempProject();
  const completion = triage.completionContract('run-123', [{
    id: 'example-agent-release',
    title: 'Example agent release',
    url: 'https://example.com/release',
    summary: 'Example source claim text.',
    content: '<p>Example source claim text.</p>',
  }]);
  completion.results[0].verdict = 'publish_public';
  completion.results[0].verdict_reason = 'Promoted for the round-trip test.';

  const primaryPath = path.join(root, 'completion.json');
  writeJson(primaryPath, completion);

  const synthesized = synthesizeRuns.synthesize({
    date: '2026-05-20',
    primaryPath: 'completion.json',
    baseDir: root,
  });

  assert.equal(synthesized.items[0].raw_claim, 'Example source claim text.');
  assert.deepEqual(synthesized.items[0].source_facts, ['Example source claim text.']);

  const synthesizedPath = path.join(root, 'artifacts/synthesized/2026-05-20.json');
  writeJson(synthesizedPath, synthesized);

  const imported = digestImport.importDigest({
    date: '2026-05-20',
    sourcePath: 'artifacts/synthesized/2026-05-20.json',
    baseDir: root,
  });

  assert.equal(imported.adapter, 'triage-candidate-export');
  assert.equal(fs.existsSync(path.join(root, 'artifacts/digests/2026-05-20.json')), true);
});

test('synthesize rejects completion items that are missing both raw_claim and source_facts', () => {
  const root = makeTempProject();
  const completion = {
    run_id: 'run-123',
    private_memo: '# Memo',
    results: [
      {
        raw_item_id: 'missing-claim',
        title: 'Example item',
        summary: 'Still missing the contract fields.',
        category: 'builder_report',
        evidence_level: 'early_signal',
        evidence_sources: ['https://example.com/item'],
        uncertainty: '',
        worth_mentioning_reason: 'Example reason.',
        score_worth_mentioning: 1,
        score_solo_dev_relevance: 1,
        score_owner_work_relevance: 1,
        score_future_work_relevance: 1,
        score_decision_impact: 1,
        score_evidence_strength: 1,
        score_cost_time_leverage: 1,
        score_risk_reduction: 1,
        score_business_opportunity: 1,
        score_hype_risk: 0,
        score_novelty_penalty: 0,
        verdict: 'reject',
        verdict_reason: 'No usable claim fields.',
      },
    ],
  };

  writeJson(path.join(root, 'completion.json'), completion);

  assert.throws(
    () => synthesizeRuns.synthesize({
      date: '2026-05-20',
      primaryPath: 'completion.json',
      baseDir: root,
    }),
    /must include source_facts or raw_claim/
  );
});
