const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const digestImport = require('../scripts/digest-import.js');
const social = require('../scripts/social-generate.js');
const triage = require('../src/triage.js');

const repoRoot = path.resolve(__dirname, '..');
const producerFixtureDir = path.join(repoRoot, 'test/fixtures/producer');
const completedFixture = path.join(producerFixtureDir, 'completed-structured-export-2026-05-20.json');

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-producer-export-'));
  fs.mkdirSync(path.join(root, 'upstream'), { recursive: true });
  return root;
}

function fakePool(run, rows) {
  return {
    async query(sql) {
      if (sql.includes('FROM nightly_runs')) {
        return { rows: [run] };
      }
      if (sql.includes('FROM candidates')) {
        return { rows };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

function completedRun(overrides = {}) {
  return {
    id: 'producer-run-2026-05-20',
    status: 'completed',
    started_at: new Date('2026-05-20T06:00:00.000Z'),
    completed_at: new Date('2026-05-20T07:00:00.000Z'),
    private_memo: '# Nightly Librarian private memo',
    items_triaged: 3,
    items_scored: 3,
    items_rejected: 1,
    items_published: 1,
    ...overrides,
  };
}

function candidateRows() {
  return [
    {
      raw_item_id: 'example-managed-agents',
      title: 'Example runtime vendor adds managed agent isolation',
      summary: 'An example runtime vendor is moving managed agent execution closer to private infrastructure.',
      verdict: 'publish_public',
      verdict_reason: 'High relevance to AI operations.',
      raw_claim: 'Example Ops Blog says managed agents can run tool calls inside isolated microVMs near private backends.',
      category: 'agent_workflow',
      evidence_level: 'vendor_claim',
      evidence_sources: ['https://source.example/managed-agent-isolation'],
      uncertainty: '',
      worth_mentioning_reason: 'Builders can test agent execution closer to production infrastructure without managing the full agent runtime themselves.',
      score_worth_mentioning: 5,
      score_solo_dev_relevance: 4,
      score_owner_work_relevance: 4,
      score_future_work_relevance: 5,
      score_decision_impact: 5,
      score_evidence_strength: 4,
      score_cost_time_leverage: 3,
      score_risk_reduction: 3,
      score_business_opportunity: 3,
      score_hype_risk: 1,
      score_novelty_penalty: 0,
      source_id: 'Example Ops Blog',
      url: 'https://source.example/managed-agent-isolation',
      content: '<p>Example managed agents launch.</p>',
      fetched_at: new Date('2026-05-20T00:05:00.000Z'),
      published_at: new Date('2026-05-20T00:00:00.000Z'),
    },
    {
      raw_item_id: 'example-guardrails',
      title: 'Example tool project publishes local-agent guardrails',
      summary: 'An example tool project gives local-agent builders a concrete guardrail target.',
      verdict: 'monitor',
      verdict_reason: 'Worth monitoring for local-agent workflows.',
      raw_claim: 'Example Tools Repo ships an evaluation harness for local LLM tool-calling reliability.',
      category: 'agent_workflow',
      evidence_level: 'builder_reported',
      evidence_sources: ['https://source.example/local-agent-guardrails'],
      uncertainty: 'Early tool; benchmark coverage may change.',
      worth_mentioning_reason: 'Local-agent builders get a concrete benchmark target before trusting an 8B model with multi-step tool use.',
      score_worth_mentioning: 4,
      score_solo_dev_relevance: 4,
      score_owner_work_relevance: 3,
      score_future_work_relevance: 4,
      score_decision_impact: 3,
      score_evidence_strength: 3,
      score_cost_time_leverage: 3,
      score_risk_reduction: 2,
      score_business_opportunity: 2,
      score_hype_risk: 1,
      score_novelty_penalty: 0,
      source_id: 'Example Tools Repo',
      url: 'https://source.example/local-agent-guardrails',
      content: '<p>Example guardrails.</p>',
      fetched_at: new Date('2026-05-20T01:20:00.000Z'),
      published_at: new Date('2026-05-20T01:15:00.000Z'),
    },
  ];
}

test('triage:report keeps markdown report behavior by default', async () => {
  const result = await triage.reportAgentTriage(fakePool(completedRun(), candidateRows()), ['--run-id=producer-run-2026-05-20']);

  assert.equal(result.status, 'reported');
  assert.equal(result.run_id, 'producer-run-2026-05-20');
  assert.match(result.markdown, /## Worth attention/);
  assert.match(result.markdown, /Example runtime vendor adds managed agent isolation/);
  assert.equal(result.schema, undefined);
});

test('triage:report structured-json emits producer export accepted by import and social dry-run', async () => {
  const exportJson = await triage.reportAgentTriage(
    fakePool(completedRun(), candidateRows()),
    ['--run-id', 'producer-run-2026-05-20', '--format', 'structured-json', '--date', '2026-05-20']
  );

  assert.equal(exportJson.schema, 'nightly-librarian.triage-candidate-export/v1');
  assert.equal(exportJson.status, 'reported');
  assert.equal(exportJson.run_status, 'completed');
  assert.equal(exportJson.mode, 'primary');
  assert.equal(exportJson.items.length, 2);
  assert.equal(exportJson.items[0].raw_claim, candidateRows()[0].raw_claim);

  const root = makeTempProject();
  fs.writeFileSync(path.join(root, 'upstream/producer.json'), `${JSON.stringify(exportJson, null, 2)}\n`);

  const imported = digestImport.importDigest({
    date: '2026-05-20',
    sourcePath: 'upstream/producer.json',
    baseDir: root,
  });
  assert.equal(imported.adapter, 'triage-candidate-export');

  const generated = social.generate({
    date: '2026-05-20',
    inputPath: 'artifacts/digests/2026-05-20.json',
    baseDir: root,
    dryRun: true,
  });
  assert.equal(generated.gating.input_valid, true);
  assert.equal(generated.side_effects.writes_files, false);
});

test('triage structured export rejects incomplete producer runs before import', async () => {
  await assert.rejects(
    () => triage.reportAgentTriage(
      fakePool(completedRun({ status: 'failed' }), candidateRows()),
      ['--run-id', 'producer-run-2026-05-20', '--format', 'structured-json', '--date', '2026-05-20']
    ),
    /Cannot export structured digest/
  );
});

test('completed producer fixture round-trips through digest import and social dry-run', () => {
  const root = makeTempProject();
  fs.copyFileSync(completedFixture, path.join(root, 'upstream/producer.json'));

  const imported = digestImport.importDigest({
    date: '2026-05-20',
    sourcePath: 'upstream/producer.json',
    baseDir: root,
  });
  assert.equal(imported.item_count, 3);

  const generated = social.generate({
    date: '2026-05-20',
    inputPath: 'artifacts/digests/2026-05-20.json',
    baseDir: root,
    dryRun: true,
  });
  assert.equal(generated.gating.input_valid, true);
});

test('invalid producer fixtures are rejected before import completes', () => {
  const cases = [
    ['failed-structured-export-2026-05-20.json', /status must be completed/],
    ['partial-structured-export-2026-05-20.json', /status must be completed/],
    ['missing-source-url-2026-05-20.json', /must include an http\(s\) source URL/],
    ['missing-facts-2026-05-20.json', /must include source_facts or raw_claim/],
  ];

  for (const [fixture, pattern] of cases) {
    const root = makeTempProject();
    fs.copyFileSync(path.join(producerFixtureDir, fixture), path.join(root, 'upstream/producer.json'));
    assert.throws(
      () => digestImport.importDigest({
        date: '2026-05-20',
        sourcePath: 'upstream/producer.json',
        baseDir: root,
      }),
      pattern
    );
  }
});
