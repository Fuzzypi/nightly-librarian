const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const social = require('../scripts/social-generate.js');

const repoRoot = path.resolve(__dirname, '..');
const fixturePath = path.join(repoRoot, 'test/fixtures/digests/2026-05-20.json');

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-social-generate-'));
  const inputDir = path.join(root, 'artifacts/digests');
  fs.mkdirSync(inputDir, { recursive: true });
  fs.copyFileSync(fixturePath, path.join(inputDir, '2026-05-20.json'));
  return root;
}

function read(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('generate writes deterministic brief, social drafts, and manifest', () => {
  const root = makeTempProject();

  const result = social.generate({ date: '2026-05-20', baseDir: root });

  assert.equal(result.dry_run, false);
  assert.equal(result.side_effects.network, false);
  assert.equal(result.side_effects.public_posting, false);
  assert.deepEqual(result.operations.map((operation) => operation.status), [
    'created',
    'created',
    'created',
    'created',
  ]);

  const brief = read(root, 'dist/briefs/2026-05-20.md');
  assert.match(brief, /# Nightly Librarian - 2026-05-20/);
  assert.match(brief, /## Daily summary/);
  assert.match(brief, /Landing page: https:\/\/thenightlylibrarian\.com\/briefs\/2026-05-20/);
  assert.match(brief, /## All researched links \(complete index\)/);
  assert.match(brief, /\[R\] \[Cloudflare adds Claude Managed Agents support\]/);

  const x = read(root, 'dist/social/2026-05-20.x.md');
  const xPosts = x.trimEnd().split('\n\n---\n\n');
  assert.equal(xPosts.length, 1);
  assert.ok(xPosts.every((post) => post.length <= social.X_LIMIT));
  assert.match(xPosts[0], /^Nightly Librarian \(2026-05-20\)/);
  assert.match(x, /https:\/\/thenightlylibrarian\.com\/briefs\/2026-05-20/);

  const linkedin = read(root, 'dist/social/2026-05-20.linkedin.md');
  assert.match(linkedin, /# LinkedIn Draft - 2026-05-20/);
  assert.match(linkedin, /Read the full brief/);
  assert.match(linkedin, /https:\/\/thenightlylibrarian\.com\/briefs\/2026-05-20/);
  assert.match(linkedin, /Draft status: not approved for posting\./);

  const manifest = JSON.parse(read(root, 'dist/social/2026-05-20.json'));
  assert.equal(manifest.approved, false);
  assert.equal(manifest.generated_at, '2026-05-20T07:00:00.000Z');
  assert.equal(manifest.generator_version, social.GENERATOR_VERSION);
  assert.equal(manifest.input_artifact, 'artifacts/digests/2026-05-20.json');
  assert.equal(manifest.channels.x.post_count, 1);
  assert.deepEqual(manifest.channels.x.character_counts, xPosts.map((post) => post.length));
  assert.equal(manifest.landing_url, 'https://thenightlylibrarian.com/briefs/2026-05-20');
  assert.equal(manifest.sources[0].claim_type, 'launch');
  assert.equal(manifest.sources[1].claim_type, 'benchmark');
});

test('generate is idempotent for the same input', () => {
  const root = makeTempProject();
  social.generate({ date: '2026-05-20', baseDir: root });

  const before = {
    brief: read(root, 'dist/briefs/2026-05-20.md'),
    manifest: read(root, 'dist/social/2026-05-20.json'),
    x: read(root, 'dist/social/2026-05-20.x.md'),
    linkedin: read(root, 'dist/social/2026-05-20.linkedin.md'),
  };

  const result = social.generate({ date: '2026-05-20', baseDir: root });

  assert.ok(result.operations.every((operation) => operation.status === 'unchanged'));
  assert.deepEqual(before, {
    brief: read(root, 'dist/briefs/2026-05-20.md'),
    manifest: read(root, 'dist/social/2026-05-20.json'),
    x: read(root, 'dist/social/2026-05-20.x.md'),
    linkedin: read(root, 'dist/social/2026-05-20.linkedin.md'),
  });
});

test('dry run validates input and does not write files', () => {
  const root = makeTempProject();

  const result = social.generate({ date: '2026-05-20', baseDir: root, dryRun: true });

  assert.equal(result.dry_run, true);
  assert.equal(result.gating.input_valid, true);
  assert.equal(result.side_effects.writes_files, false);
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('generate rejects non-completed digests', () => {
  const root = makeTempProject();
  const inputPath = path.join(root, 'artifacts/digests/2026-05-20.json');
  const digest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  digest.status = 'partial';
  fs.writeFileSync(inputPath, `${JSON.stringify(digest, null, 2)}\n`);

  assert.throws(
    () => social.generate({ date: '2026-05-20', baseDir: root }),
    /Digest status must be completed/
  );
});

test('generate rejects mismatched requested date', () => {
  const root = makeTempProject();

  assert.throws(
    () => social.generate({
      date: '2026-05-21',
      baseDir: root,
      inputPath: 'artifacts/digests/2026-05-20.json',
    }),
    /does not match requested date/
  );
});

test('generate rejects malformed digest timestamps', () => {
  const root = makeTempProject();
  const inputPath = path.join(root, 'artifacts/digests/2026-05-20.json');
  const digest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  digest.generated_at = '2026-05-20';
  fs.writeFileSync(inputPath, `${JSON.stringify(digest, null, 2)}\n`);

  assert.throws(
    () => social.generate({ date: '2026-05-20', baseDir: root }),
    /generated_at must be an ISO-8601 timestamp/
  );
});

test('generate labels completed fallback artifacts', () => {
  const root = makeTempProject();
  const inputPath = path.join(root, 'artifacts/digests/2026-05-20.json');
  const digest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  digest.mode = 'fallback';
  fs.writeFileSync(inputPath, `${JSON.stringify(digest, null, 2)}\n`);

  social.generate({ date: '2026-05-20', baseDir: root });

  const brief = read(root, 'dist/briefs/2026-05-20.md');
  const x = read(root, 'dist/social/2026-05-20.x.md');
  const manifest = JSON.parse(read(root, 'dist/social/2026-05-20.json'));

  assert.match(brief, /Fallback digest:/);
  assert.match(x, /Fallback digest/);
  assert.equal(manifest.fallback, true);
  assert.equal(manifest.mode, 'fallback');
});

test('generate refuses to overwrite approved output', () => {
  const root = makeTempProject();
  social.generate({ date: '2026-05-20', baseDir: root });

  const manifestPath = path.join(root, 'dist/social/2026-05-20.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.approved = true;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const inputPath = path.join(root, 'artifacts/digests/2026-05-20.json');
  const digest = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  digest.summary = 'A changed digest summary should not replace approved output.';
  fs.writeFileSync(inputPath, `${JSON.stringify(digest, null, 2)}\n`);

  assert.throws(
    () => social.generate({ date: '2026-05-20', baseDir: root }),
    /Refusing to overwrite approved social output/
  );
});
