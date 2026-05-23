const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const reportWrite = require("../scripts/report-write.js");

function makeTempProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "nl-report-write-"));
}

test("writeFromReportResult writes a tracked daily report markdown file", () => {
  const root = makeTempProject();
  const inputPath = path.join(root, "report.json");
  fs.writeFileSync(inputPath, JSON.stringify({
    run_id: "run-123",
    markdown: `# Nightly Librarian — Newsletter draft

Run: run-123
Completed: 2026-05-24T06:21:00.000Z

## Worth attention

- **Example story**
  https://example.com/story
  Summary text.

## Full digest

- [P] [source-a] Example story — https://example.com/story — Summary text.
`,
  }, null, 2));

  const result = reportWrite.writeFromReportResult({
    date: "2026-05-24",
    inputPath,
    baseDir: root,
  });

  assert.equal(result.status, "created");
  assert.equal(result.output, "reports/2026-05-24.md");
  assert.match(
    fs.readFileSync(path.join(root, "reports/2026-05-24.md"), "utf8"),
    /## Worth attention/
  );
});

test("writeFromReportResult rejects mismatched completed date", () => {
  const root = makeTempProject();
  const inputPath = path.join(root, "report.json");
  fs.writeFileSync(inputPath, JSON.stringify({
    run_id: "run-123",
    markdown: `# Nightly Librarian — Newsletter draft

Completed: 2026-05-23T06:21:00.000Z

## Worth attention

- **Example story**
  https://example.com/story
  Summary text.

## Full digest

- [P] [source-a] Example story — https://example.com/story — Summary text.
`,
  }, null, 2));

  assert.throws(
    () => reportWrite.writeFromReportResult({
      date: "2026-05-24",
      inputPath,
      baseDir: root,
    }),
    /does not match requested date/
  );
});
