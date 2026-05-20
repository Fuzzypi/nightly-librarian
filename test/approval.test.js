const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const approval = require('../scripts/approval.js');

const repoRoot = path.resolve(__dirname, '..');
const digestFixture = path.join(repoRoot, 'test/fixtures/digests/2026-05-20.json');
const approvalFixtureDir = path.join(repoRoot, 'test/fixtures/approvals');

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-approval-'));
  fs.mkdirSync(path.join(root, 'artifacts/digests'), { recursive: true });
  fs.copyFileSync(digestFixture, path.join(root, 'artifacts/digests/2026-05-20.json'));
  return root;
}

function copyApprovalFixture(root, fixtureName) {
  const target = path.join(root, 'artifacts/approvals/2026-05-20.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(approvalFixtureDir, fixtureName), target);
  return 'artifacts/approvals/2026-05-20.json';
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

test('validateApproval accepts an explicit approval artifact for deterministic local drafts', () => {
  const root = makeTempProject();
  const approvalPath = copyApprovalFixture(root, 'valid-approval-2026-05-20.json');

  const result = approval.validateApproval({
    approvalPath,
    baseDir: root,
    date: '2026-05-20',
    digestPath: 'artifacts/digests/2026-05-20.json',
  });

  assert.equal(result.approved, true);
  assert.deepEqual(result.channels_approved, ['brief', 'x', 'linkedin']);
  assert.equal(result.digest, 'artifacts/digests/2026-05-20.json');
  assert.equal(result.social_manifest, 'dist/social/2026-05-20.json');
  assert.equal(result.side_effects.network, false);
  assert.equal(result.side_effects.public_posting, false);
  assert.equal(result.side_effects.writes_files, false);
  assert.equal(fs.existsSync(path.join(root, 'dist')), false);
});

test('createApproval writes an explicit approval artifact and is idempotent', () => {
  const root = makeTempProject();

  const first = approval.createApproval({
    approvalPath: 'artifacts/approvals/2026-05-20.json',
    approvedAt: '2026-05-20T08:00:00.000Z',
    approver: 'Fixture Approver',
    baseDir: root,
    date: '2026-05-20',
    digestPath: 'artifacts/digests/2026-05-20.json',
  });
  assert.equal(first.operation.status, 'created');
  assert.equal(first.side_effects.public_posting, false);

  const artifact = readJson(root, 'artifacts/approvals/2026-05-20.json');
  assert.equal(artifact.schema, approval.APPROVAL_SCHEMA);
  assert.equal(artifact.status, 'approved');
  assert.equal(artifact.digest.path, 'artifacts/digests/2026-05-20.json');

  const second = approval.createApproval({
    approvalPath: 'artifacts/approvals/2026-05-20.json',
    approvedAt: '2026-05-20T08:00:00.000Z',
    approver: 'Fixture Approver',
    baseDir: root,
    date: '2026-05-20',
    digestPath: 'artifacts/digests/2026-05-20.json',
  });
  assert.equal(second.operation.status, 'unchanged');

  const validated = approval.validateApproval({
    approvalPath: 'artifacts/approvals/2026-05-20.json',
    baseDir: root,
    date: '2026-05-20',
    digestPath: 'artifacts/digests/2026-05-20.json',
  });
  assert.equal(validated.approved, true);
});

test('createApproval dry run validates without writing approval state', () => {
  const root = makeTempProject();

  const result = approval.createApproval({
    approvalPath: 'artifacts/approvals/2026-05-20.json',
    approvedAt: '2026-05-20T08:00:00.000Z',
    approver: 'Fixture Approver',
    baseDir: root,
    date: '2026-05-20',
    digestPath: 'artifacts/digests/2026-05-20.json',
    dryRun: true,
  });

  assert.equal(result.dry_run, true);
  assert.equal(result.side_effects.writes_files, false);
  assert.equal(fs.existsSync(path.join(root, 'artifacts/approvals')), false);
});

test('validateApproval fails closed when approval is missing', () => {
  const root = makeTempProject();

  assert.throws(
    () => approval.validateApproval({
      approvalPath: 'artifacts/approvals/2026-05-20.json',
      baseDir: root,
      date: '2026-05-20',
      digestPath: 'artifacts/digests/2026-05-20.json',
    }),
    /Approval artifact missing/
  );
});

test('validateApproval rejects invalid approval fixtures', () => {
  const cases = [
    ['wrong-date-approval-2026-05-20.json', /approval.date mismatch/],
    ['stale-approval-2026-05-20.json', /Approval artifact is stale/],
    ['malformed-approval-2026-05-20.json', /approval.schema mismatch/],
    ['mismatched-digest-approval-2026-05-20.json', /digest.sha256 mismatch/],
    ['mismatched-social-approval-2026-05-20.json', /social.manifest.sha256 mismatch/],
  ];

  for (const [fixtureName, pattern] of cases) {
    const root = makeTempProject();
    const approvalPath = copyApprovalFixture(root, fixtureName);
    assert.throws(
      () => approval.validateApproval({
        approvalPath,
        baseDir: root,
        date: '2026-05-20',
        digestPath: 'artifacts/digests/2026-05-20.json',
      }),
      pattern
    );
  }
});

test('validateApproval rejects approval for a changed digest input', () => {
  const root = makeTempProject();
  const approvalPath = copyApprovalFixture(root, 'valid-approval-2026-05-20.json');
  const digest = readJson(root, 'artifacts/digests/2026-05-20.json');
  digest.summary = 'Changed after approval.';
  fs.writeFileSync(path.join(root, 'artifacts/digests/2026-05-20.json'), `${JSON.stringify(digest, null, 2)}\n`);

  assert.throws(
    () => approval.validateApproval({
      approvalPath,
      baseDir: root,
      date: '2026-05-20',
      digestPath: 'artifacts/digests/2026-05-20.json',
    }),
    /digest.sha256 mismatch/
  );
});
