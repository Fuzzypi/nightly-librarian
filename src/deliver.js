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
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      console.log('No memo found');
      return;
    }

    const { id, started_at, private_memo } = result.rows[0];
    const date = new Date(started_at).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'America/New_York',
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nightly Librarian — ${date}</title>
<style>
body{max-width:700px;margin:40px auto;padding:0 20px;font-family:Georgia,serif;line-height:1.7;color:#1a1a1a;background:#fafaf8}
h1{font-size:1.4em;border-bottom:1px solid #ccc;padding-bottom:8px}
h2{font-size:1.1em;margin-top:1.5em;color:#333}
ul{padding-left:20px}li{margin-bottom:8px}
a{color:#2563eb}
.meta{font-size:0.85em;color:#666;margin-bottom:24px}
code{background:#eee;padding:2px 5px;border-radius:3px;font-size:0.9em}
</style>
</head>
<body>
<h1>The Nightly Librarian</h1>
<div class="meta">${date}</div>
${private_memo}
</body>
</html>`;

    await fs.mkdir(MEMO_DIR, { recursive: true });
    await fs.writeFile(MEMO_DIR + '/index.html', html);
    console.log(`Memo delivered: ${date} (run ${id.slice(0, 8)})`);
  } finally {
    await pool.end();
  }
}

deliver().catch(err => { console.error(err); process.exit(1); });
