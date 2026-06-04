require('dotenv').config();
const fs = require('fs/promises');
const { createPool } = require('./db');

const MEMO_DIR = '/var/www/nightly-librarian';

async function deliver() {
  const pool = createPool();
  try {
    const result = await pool.query(
      `SELECT id, started_at, private_memo
       FROM nightly_runs
       WHERE private_memo IS NOT NULL
       ORDER BY started_at DESC
       LIMIT 30`
    );

    if (result.rows.length === 0) {
      console.log('No memos found');
      return;
    }

    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/New_York',
    });

    const latest = result.rows[0];
    const latestDate = formatDate(latest.started_at);

    const memoSections = result.rows.map((row) => {
      const date = formatDate(row.started_at);
      return `<section class="memo">
<h2>${date}</h2>
<div class="memo-body">${row.private_memo.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/^## (.+)$/gm, '<h3>$1</h3>').replace(/^- \*\*(.+?)\*\*:? ?(.*)$/gm, '<li><strong>$1</strong> $2</li>').replace(/^- (.+)$/gm, '<li>$1</li>').replace(/(<li>)/g, '$1').replace(/\n/g, '\n')}</div>
</section>`;
    }).join('\n<hr>\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nightly Librarian — ${latestDate}</title>
<style>
body{max-width:700px;margin:40px auto;padding:0 20px;font-family:Georgia,serif;line-height:1.7;color:#1a1a1a;background:#fafaf8}
h1{font-size:1.4em;border-bottom:1px solid #ccc;padding-bottom:8px}
h2{font-size:1.15em;margin-top:2em;color:#222}
h3{font-size:1em;margin-top:1.2em;color:#444}
li{margin-bottom:8px}
a{color:#2563eb}
hr{border:none;border-top:1px solid #ddd;margin:2em 0}
.meta{font-size:0.85em;color:#666;margin-bottom:24px}
.memo-body{white-space:pre-line}
strong{color:#111}
</style>
</head>
<body>
<h1>The Nightly Librarian</h1>
<div class="meta">${result.rows.length} reports &middot; Latest: ${latestDate}</div>
${memoSections}
</body>
</html>`;

    await fs.mkdir(MEMO_DIR, { recursive: true });
    await fs.writeFile(MEMO_DIR + '/index.html', html);
    console.log(`Delivered ${result.rows.length} memos, latest: ${latestDate}`);
  } finally {
    await pool.end();
  }
}

deliver().catch(err => { console.error(err); process.exit(1); });
