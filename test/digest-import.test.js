const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const digestImport = require('../scripts/digest-import.js');
const social = require('../scripts/social-generate.js');

const repoRoot = path.resolve(__dirname, '..');
const candidateFixture = path.join(repoRoot, 'test/fixtures/upstream/triage-candidate-export-2026-05-20.json');
const normalizedFixture = path.join(repoRoot, 'test/fixtures/digests/2026-05-20.json');

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-digest-import-'));
  fs.mkdirSync(path.join(root, 'upstream'), { recursive: true });
  return root;
}

function copyFixture(root, fixture, name) {
  const target = path.join(root, 'upstream', name);
  fs.copyFileSync(fixture, target);
  return path.relative(root, target);
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('importDigest normalizes a structured triage candidate export', () => {
  const root = makeTempProject();
  const source = copyFixture(root, candidateFixture, 'candidate-export.json');

  const result = digestImport.importDigest({ date: '2026-05-20', sourcePath: source, baseDir: root });

  assert.equal(result.adapter, 'triage-candidate-export');
  assert.equal(result.side_effects.network, false);
  assert.equal(result.side_effects.credentials, false);
  assert.equal(result.side_effects.public_posting, false);
  assert.equal(result.operation.status, 'created');

  const digest = readJson(root, 'artifacts/digests/2026-05-20.json');
  assert.equal(digest.status, 'completed');
  assert.equal(digest.mode, 'primary');
  assert.equal(digest.generated_at, '2026-05-20T07:00:00.000Z');
  assert.equal(digest.imported_from.importer_version, digestImport.IMPORTER_VERSION);
  assert.equal(digest.items[0].importance, 'lead');
  assert.equal(digest.items[1].importance, 'supporting');
  assert.equal(digest.items[2].importance, 'archive-only');
  assert.equal(digest.items[0].category, 'AI Operations / Agent Control');
  assert.equal(digest.items[2].category, 'Small Business Automation');
  assert.deepEqual(digest.items[0].source_facts, [
    'Cloudflare says Claude Managed Agents can run tool calls inside isolated Firecracker microVMs near private backends.',
  ]);

  const generated = social.generate({ date: '2026-05-20', baseDir: root, dryRun: true });
  assert.equal(generated.gating.input_valid, true);
  assert.equal(generated.side_effects.writes_files, false);
});

test('importDigest accepts an already normalized Phase 1 digest artifact', () => {
  const root = makeTempProject();
  const source = copyFixture(root, normalizedFixture, 'normalized-digest.json');

  const result = digestImport.importDigest({ date: '2026-05-20', sourcePath: source, baseDir: root });

  assert.equal(result.adapter, 'phase1-digest');
  const digest = readJson(root, 'artifacts/digests/2026-05-20.json');
  assert.equal(digest.items.length, 3);
  assert.equal(digest.items[0].source, 'Cloudflare Blog');
  assert.equal(digest.imported_from.source_artifact, 'upstream/normalized-digest.json');
});

test('dry run validates import without writing output', () => {
  const root = makeTempProject();
  const source = copyFixture(root, candidateFixture, 'candidate-export.json');

  const result = digestImport.importDigest({
    date: '2026-05-20',
    sourcePath: source,
    baseDir: root,
    dryRun: true,
  });

  assert.equal(result.dry_run, true);
  assert.equal(result.output, 'artifacts/digests/2026-05-20.json');
  assert.equal(result.side_effects.writes_files, false);
  assert.equal(fs.existsSync(path.join(root, 'artifacts')), false);
});

test('importDigest is idempotent and protects differing existing output', () => {
  const root = makeTempProject();
  const source = copyFixture(root, candidateFixture, 'candidate-export.json');

  digestImport.importDigest({ date: '2026-05-20', sourcePath: source, baseDir: root });
  const second = digestImport.importDigest({ date: '2026-05-20', sourcePath: source, baseDir: root });
  assert.equal(second.operation.status, 'unchanged');

  const outputPath = path.join(root, 'artifacts/digests/2026-05-20.json');
  const digest = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  digest.summary = 'Changed local output.';
  writeJson(outputPath, digest);

  assert.throws(
    () => digestImport.importDigest({ date: '2026-05-20', sourcePath: source, baseDir: root }),
    /Output already exists and differs/
  );

  const forced = digestImport.importDigest({
    date: '2026-05-20',
    sourcePath: source,
    baseDir: root,
    force: true,
  });
  assert.equal(forced.operation.status, 'updated');
});

test('importDigest rejects failed or partial upstream artifacts', () => {
  const root = makeTempProject();
  const source = path.join(root, 'upstream', 'failed.json');
  const fixture = JSON.parse(fs.readFileSync(candidateFixture, 'utf8'));
  fixture.status = 'failed';
  writeJson(source, fixture);

  assert.throws(
    () => digestImport.importDigest({ date: '2026-05-20', sourcePath: 'upstream/failed.json', baseDir: root }),
    /status must be completed/
  );
});

test('importDigest rejects reported wrappers without completed run status', () => {
  const root = makeTempProject();
  const source = path.join(root, 'upstream', 'reported-without-completion.json');
  const fixture = JSON.parse(fs.readFileSync(candidateFixture, 'utf8'));
  delete fixture.run_status;
  writeJson(source, fixture);

  assert.throws(
    () => digestImport.importDigest({
      date: '2026-05-20',
      sourcePath: 'upstream/reported-without-completion.json',
      baseDir: root,
    }),
    /status must be completed/
  );
});

test('importDigest rejects markdown-only reports because source facts cannot be recovered safely', () => {
  const root = makeTempProject();
  const source = path.join(root, 'upstream', 'report.json');
  writeJson(source, {
    date: '2026-05-20',
    status: 'reported',
    run_status: 'completed',
    mode: 'primary',
    summary: 'A markdown report without structured source facts.',
    markdown: '# Nightly Librarian\n\n## Worth attention\n\n- A story',
  });

  assert.throws(
    () => digestImport.importDigest({ date: '2026-05-20', sourcePath: 'upstream/report.json', baseDir: root }),
    /no structured items/
  );
});

test('importDigest rejects candidate items without source facts or raw claims', () => {
  const root = makeTempProject();
  const source = path.join(root, 'upstream', 'missing-facts.json');
  const fixture = JSON.parse(fs.readFileSync(candidateFixture, 'utf8'));
  delete fixture.items[0].raw_claim;
  delete fixture.items[0].source_facts;
  writeJson(source, fixture);

  assert.throws(
    () => digestImport.importDigest({ date: '2026-05-20', sourcePath: 'upstream/missing-facts.json', baseDir: root }),
    /must include source_facts or raw_claim/
  );
});
